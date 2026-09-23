import { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { badRequest, conflict, notFound } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import type { MatchEventType } from "@/lib/constants";
import { applyMatchAction, computeScore, reachesYellowThreshold, type MatchAction } from "@/lib/rules/match";
import { createCardFine, voidFinesForEvents } from "@/lib/services/fines";
import { createSuspension, liftSuspensionsFromEvents, serveSuspensions } from "@/lib/services/suspensions";
import { Championship, DEFAULT_RULES, IChampionship } from "@/models/Championship";
import { requireOrganizer } from "@/lib/permissions";
import { IMatch, Match } from "@/models/Match";
import { IMatchEvent, MatchEvent } from "@/models/MatchEvent";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { Suspension } from "@/models/Suspension";

// Goals are not here: an amateur match often doesn't have a confirmed scorer, and the score should
// still be easy to correct on the spot. Cards and substitutions are always about one specific player.
const PLAYER_REQUIRED: MatchEventType[] = ["penalty_missed", "yellow_card", "red_card", "substitution"];

async function loadMatch(matchId: string, actor?: Actor) {
  const match = await Match.findById(matchId);
  if (!match) throw notFound("Partido no encontrado");
  const championship = await Championship.findById(match.championshipId).lean();
  if (!championship) throw notFound("Campeonato no encontrado");
  if (actor) requireOrganizer(actor, championship);
  return { match, championship };
}

const rule = <K extends keyof IChampionship["rules"]>(championship: IChampionship, key: K): IChampionship["rules"][K] =>
  championship.rules[key] ?? (DEFAULT_RULES[key] as IChampionship["rules"][K]);

/** Re-derives and stores the score from the non-voided events. */
export async function recomputeScore(match: Pick<IMatch, "_id" | "homeTeamId" | "awayTeamId">) {
  const events = await MatchEvent.find({ matchId: match._id, type: { $in: ["goal", "penalty_goal", "own_goal"] } }).lean();
  const score = computeScore(
    events.map((event) => ({ type: event.type, teamId: event.teamId.toString(), voided: event.voided })),
    match.homeTeamId.toString(),
    match.awayTeamId.toString()
  );
  await Match.updateOne({ _id: match._id }, { homeScore: score.home, awayScore: score.away });
  return score;
}

// Whether the player actually checked in as present is not required: many amateur organizers don't
// run attendance strictly, and the whole active squad is called up automatically for every match.
async function assertCalledUp(matchId: Types.ObjectId, playerId: string, teamId: string) {
  const checkIn = await PlayerCheckIn.findOne({ matchId, playerId }).lean();
  if (!checkIn) throw conflict("El jugador no fue convocado a este partido", "player_not_called_up");
  if (checkIn.teamId.toString() !== teamId) throw badRequest("El jugador no pertenece a ese equipo");
}

async function assertNotSentOff(matchId: Types.ObjectId, playerId: string) {
  const redCard = await MatchEvent.exists({ matchId, playerId, type: "red_card", voided: false });
  if (redCard) throw conflict("El jugador fue expulsado y no puede tener más eventos", "player_sent_off");
}

export interface CreateEventInput {
  type: MatchEventType;
  teamId: string;
  playerId?: string;
  relatedPlayerId?: string;
  minute: number;
  note?: string;
}

export async function createEvent(actor: Actor, matchId: string, input: CreateEventInput) {
  const { match, championship } = await loadMatch(matchId, actor);
  // New events are allowed in any state except the two "closed" ones: a W.O. never had real play,
  // and a finished match is done (past events can still be voided to fix a mistake).
  if (match.status === "walkover" || match.status === "finished") {
    throw conflict("El partido está cerrado; no se pueden registrar eventos nuevos", "match_closed");
  }
  if (match.homeTeamId.toString() !== input.teamId && match.awayTeamId.toString() !== input.teamId) {
    throw badRequest("El equipo no participa en este partido");
  }

  if (PLAYER_REQUIRED.includes(input.type) && !input.playerId) throw badRequest("Selecciona al jugador");
  if (input.playerId) {
    await assertCalledUp(match._id, input.playerId, input.teamId);
    await assertNotSentOff(match._id, input.playerId);
  }
  if (input.type === "goal" || input.type === "penalty_goal") {
    if (input.relatedPlayerId) await assertCalledUp(match._id, input.relatedPlayerId, input.teamId);
  }
  if (input.type === "substitution") {
    if (!input.relatedPlayerId) throw badRequest("Selecciona al jugador que entra");
    await assertCalledUp(match._id, input.relatedPlayerId, input.teamId);
    await assertNotSentOff(match._id, input.relatedPlayerId);
    const [alreadyOut, alreadyIn] = await Promise.all([
      MatchEvent.exists({ matchId: match._id, type: "substitution", voided: false, playerId: input.playerId }),
      MatchEvent.exists({ matchId: match._id, type: "substitution", voided: false, relatedPlayerId: input.relatedPlayerId }),
    ]);
    if (alreadyOut) throw conflict("El jugador ya fue sustituido", "already_substituted");
    if (alreadyIn) throw conflict("El jugador que entra ya participó en un cambio", "already_substituted");
  }

  const relatedForGoal = input.type === "goal" || input.type === "penalty_goal" || input.type === "substitution";
  const event = await MatchEvent.create({
    matchId: match._id,
    championshipId: match.championshipId,
    teamId: input.teamId,
    playerId: input.playerId,
    relatedPlayerId: relatedForGoal ? input.relatedPlayerId : undefined,
    type: input.type,
    minute: input.minute,
    note: input.note,
    recordedBy: actor.name,
  });

  const autoEvents: IMatchEvent[] = [];
  const suspensions = [];

  /** Card fines are charged when the championship sets an amount for that card. */
  const chargeCard = (type: "yellow_card" | "red_card", eventId: Types.ObjectId, concept: string) =>
    createCardFine(actor, {
      championshipId: match.championshipId, teamId: new Types.ObjectId(input.teamId), playerId: new Types.ObjectId(input.playerId!), matchId: match._id, eventId, type,
      amount: type === "yellow_card" ? rule(championship, "yellowCardFine") ?? 0 : rule(championship, "redCardFine") ?? 0, concept,
    });
  if (input.type === "yellow_card") await chargeCard("yellow_card", event._id, "Tarjeta amarilla");

  if (input.type === "yellow_card") {
    const previousYellows = await MatchEvent.find({
      matchId: match._id, playerId: input.playerId, type: "yellow_card", voided: false, _id: { $ne: event._id },
    });
    if (previousYellows.length > 0) {
      // Second yellow in the same match: automatic red card; neither yellow counts toward accumulation.
      await MatchEvent.updateMany({ _id: { $in: [event._id, ...previousYellows.map((yellow) => yellow._id)] } }, { countsForAccumulation: false });
      const red = await MatchEvent.create({
        matchId: match._id, championshipId: match.championshipId, teamId: input.teamId, playerId: input.playerId,
        type: "red_card", minute: input.minute, note: "Doble amarilla", auto: true, linkedEventId: event._id,
        recordedBy: actor.name,
      });
      autoEvents.push(red.toObject());
      await chargeCard("red_card", red._id, "Tarjeta roja (doble amarilla)");
      suspensions.push(
        await createSuspension(actor, {
          championshipId: match.championshipId, teamId: input.teamId, playerId: input.playerId!, reason: "red_card",
          matchesToServe: rule(championship, "redCardSuspensionMatches"), sourceMatchId: match._id, sourceEventId: red._id,
          note: "Doble amarilla",
        })
      );
    } else {
      const lastBan = await Suspension.findOne({
        championshipId: match.championshipId, playerId: input.playerId, reason: "yellow_accumulation", status: { $ne: "lifted" },
      }).sort({ createdAt: -1 });
      const count = await MatchEvent.countDocuments({
        championshipId: match.championshipId, playerId: input.playerId, type: "yellow_card", voided: false, countsForAccumulation: true,
        ...(lastBan ? { createdAt: { $gt: lastBan.createdAt } } : {}),
      });
      if (reachesYellowThreshold(count, rule(championship, "yellowCardsForSuspension"))) {
        suspensions.push(
          await createSuspension(actor, {
            championshipId: match.championshipId, teamId: input.teamId, playerId: input.playerId!, reason: "yellow_accumulation",
            matchesToServe: rule(championship, "yellowSuspensionMatches"), sourceMatchId: match._id, sourceEventId: event._id,
            note: `${count} amarillas acumuladas`,
          })
        );
      }
    }
  }

  if (input.type === "red_card") {
    await chargeCard("red_card", event._id, "Tarjeta roja");
    suspensions.push(
      await createSuspension(actor, {
        championshipId: match.championshipId, teamId: input.teamId, playerId: input.playerId!, reason: "red_card",
        matchesToServe: rule(championship, "redCardSuspensionMatches"), sourceMatchId: match._id, sourceEventId: event._id,
      })
    );
  }

  const score = await recomputeScore(match);
  await recordAudit(actor, {
    action: "create",
    entityType: "match_event",
    entityId: event._id,
    championshipId: match.championshipId,
    summary: `Evento ${input.type} al minuto ${input.minute}`,
    changes: { matchId, playerId: input.playerId, relatedPlayerId: input.relatedPlayerId, auto: autoEvents.map((auto) => auto._id.toString()) },
  });
  return { event: event.toObject(), autoEvents, suspensions: suspensions.map((suspension) => suspension.toObject()), score };
}

/** Voids an event (kept for the record), recomputing the score and lifting the bans it caused. */
export async function voidEvent(actor: Actor, matchId: string, eventId: string) {
  const { match } = await loadMatch(matchId, actor);
  if (match.status !== "live" && match.status !== "finished") {
    throw conflict("El partido no admite cambios en sus eventos", "match_not_live");
  }
  const event = await MatchEvent.findOne({ _id: eventId, matchId: match._id });
  if (!event) throw notFound("Evento no encontrado");
  if (event.voided) throw conflict("El evento ya está anulado", "event_already_voided");
  if (event.auto) throw conflict("Anula la segunda amarilla que generó esta expulsión", "event_is_automatic");

  const linked = await MatchEvent.find({ linkedEventId: event._id, voided: false });
  const affected = [event, ...linked];
  for (const item of affected) {
    item.set({ voided: true, voidedAt: new Date(), voidedBy: actor.name });
    await item.save();
  }
  if (linked.length > 0) {
    // The first yellow counts again once the double-yellow sending-off no longer stands.
    await MatchEvent.updateMany(
      { matchId: match._id, playerId: event.playerId, type: "yellow_card", voided: false, countsForAccumulation: false },
      { countsForAccumulation: true }
    );
  }

  const liftedBans = await liftSuspensionsFromEvents(actor, affected.map((item) => item._id));
  await voidFinesForEvents(actor, affected.map((item) => item._id));
  const score = await recomputeScore(match);
  await recordAudit(actor, {
    action: "void",
    entityType: "match_event",
    entityId: event._id,
    championshipId: match.championshipId,
    summary: `Evento ${event.type} anulado`,
    changes: { linked: linked.map((item) => item._id.toString()), liftedBans },
  });
  return { event: event.toObject(), score, liftedBans };
}

export async function listEvents(matchId: string) {
  return MatchEvent.find({ matchId })
    .sort({ minute: 1, createdAt: 1 })
    .populate({ path: "playerId", select: "fullName photoUrl" })
    .populate({ path: "relatedPlayerId", select: "fullName photoUrl" })
    .lean();
}

/** Starts, pauses, resumes or ends the match following the state machine. */
export async function transitionMatch(actor: Actor, matchId: string, action: MatchAction, options: { force?: boolean; reason?: string } = {}) {
  const { match, championship } = await loadMatch(matchId, actor);
  const next = applyMatchAction(action, { status: match.status, period: match.period ?? "not_started" });
  if (!next) throw conflict("Esa acción no está disponible en el estado actual del partido", "invalid_transition");

  if (action === "start") {
    const minimum = rule(championship, "minPlayersToStart");
    const present = await PlayerCheckIn.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { matchId: match._id, status: "present" } },
      { $group: { _id: "$teamId", count: { $sum: 1 } } },
    ]);
    const countOf = (teamId: Types.ObjectId) => present.find((row) => row._id.equals(teamId))?.count ?? 0;
    const short = [match.homeTeamId, match.awayTeamId].filter((teamId) => countOf(teamId) < minimum);
    if (short.length > 0 && !options.force) {
      throw conflict(`Cada equipo necesita al menos ${minimum} jugadores presentes para iniciar`, "not_enough_players");
    }
    if (short.length > 0 && !options.reason) throw badRequest("Indica el motivo para iniciar sin el mínimo de jugadores");
    match.startedAt = new Date();
    match.homeScore = 0;
    match.awayScore = 0;
  }

  const now = new Date();
  match.status = next.status;
  match.period = next.period;
  if (next.period === "first_half" || next.period === "second_half") match.periodStartedAt = now;
  if (next.status === "finished") match.finishedAt = now;
  await match.save();

  let servedBans = 0;
  if (next.status === "finished") servedBans = await serveSuspensions(actor, match);

  await recordAudit(actor, {
    action: "transition",
    entityType: "match",
    entityId: match._id,
    championshipId: match.championshipId,
    summary: `Partido: ${action}`,
    changes: { action, period: next.period, forced: options.force ? options.reason : undefined, servedBans },
  });
  return match.toObject();
}

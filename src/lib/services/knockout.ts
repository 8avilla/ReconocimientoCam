import type { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { badRequest, conflict, notFound } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { aggregateScore, suggestWinner } from "@/lib/rules/knockout";
import { ensureKnockoutMatchday } from "@/lib/services/matchdays";
import { Matchday } from "@/models/Matchday";
import { IPhase, IPhaseRound, Phase } from "@/models/Phase";
import { Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { Team } from "@/models/Team";
import { ITie, Tie } from "@/models/Tie";

async function loadKnockout(phaseId: string) {
  const phase = await Phase.findById(phaseId);
  if (!phase) throw notFound("Fase no encontrada");
  if (phase.type !== "knockout") throw badRequest("Esta fase no es una eliminatoria");
  return phase;
}

function findRound(phase: { rounds: IPhaseRound[] }, roundId: string) {
  const round = phase.rounds.find((entry) => entry._id.toString() === roundId);
  if (!round) throw notFound("Ronda no encontrada");
  return round;
}

async function roundHasMatches(roundId: Types.ObjectId | string, phaseId: Types.ObjectId | string) {
  const tieIds = await Tie.distinct("_id", { phaseId, roundId });
  return tieIds.length > 0 && Boolean(await Match.exists({ tieId: { $in: tieIds } }));
}

// ---------- Rounds ----------

export async function addRound(actor: Actor, phaseId: string, input: { name: string; legs: 1 | 2 }) {
  const phase = await loadKnockout(phaseId);
  if (phase.rounds.some((round) => round.name === input.name)) throw conflict("Ya existe una ronda con ese nombre", "duplicate");
  phase.rounds.push({ name: input.name, legs: input.legs, order: Math.max(0, ...phase.rounds.map((round) => round.order)) + 1 } as IPhaseRound);
  await phase.save();
  await recordAudit(actor, { action: "create", entityType: "phase", entityId: phase._id, championshipId: phase.championshipId, summary: `Ronda creada: ${input.name} (${phase.name})` });
  return phase;
}

export async function updateRound(actor: Actor, phaseId: string, roundId: string, input: { name?: string; legs?: 1 | 2 }) {
  const phase = await loadKnockout(phaseId);
  const round = findRound(phase, roundId);
  if (input.name && input.name !== round.name && phase.rounds.some((entry) => entry.name === input.name)) throw conflict("Ya existe una ronda con ese nombre", "duplicate");
  if (input.legs && input.legs !== round.legs && (await roundHasMatches(round._id, phase._id))) {
    throw conflict("La ronda ya tiene partidos; elimínalos para cambiar si es ida y vuelta", "round_has_matches");
  }
  Object.assign(round, input);
  await phase.save();
  // The matchdays of this round carry its name ("Semifinal · Ida").
  for (const matchday of await Matchday.find({ phaseId: phase._id, roundId: round._id })) {
    matchday.name = legLabel(round, (matchday.leg ?? 1) as 1 | 2);
    await matchday.save();
  }
  await recordAudit(actor, { action: "update", entityType: "phase", entityId: phase._id, championshipId: phase.championshipId, summary: `Ronda actualizada: ${round.name}`, changes: { ...input } });
  return phase;
}

export async function deleteRound(actor: Actor, phaseId: string, roundId: string) {
  const phase = await loadKnockout(phaseId);
  const round = findRound(phase, roundId);
  if (await roundHasMatches(round._id, phase._id)) throw conflict("La ronda ya tiene partidos; elimínalos primero", "round_has_matches");
  await Tie.deleteMany({ phaseId: phase._id, roundId: round._id });
  await Matchday.deleteMany({ phaseId: phase._id, roundId: round._id });
  phase.rounds = phase.rounds.filter((entry) => entry._id.toString() !== roundId) as IPhase["rounds"];
  await phase.save();
  await recordAudit(actor, { action: "delete", entityType: "phase", entityId: phase._id, championshipId: phase.championshipId, summary: `Ronda eliminada: ${round.name}` });
}

// ---------- Ties ----------

export interface TieInput {
  homeTeamId: string;
  /** Null = bye: the home team advances without playing. */
  awayTeamId: string | null;
}

/** Replaces the ties of a round with the ones the organizer defined (by hand or from a proposal). */
export async function setTies(actor: Actor, phaseId: string, roundId: string, ties: TieInput[]) {
  const phase = await loadKnockout(phaseId);
  const round = findRound(phase, roundId);
  if (await roundHasMatches(round._id, phase._id)) throw conflict("La ronda ya tiene partidos; elimínalos para cambiar los cruces", "round_has_matches");

  const inPhase = new Set(phase.teamIds.map(String));
  const used = new Set<string>();
  for (const tie of ties) {
    for (const teamId of [tie.homeTeamId, tie.awayTeamId]) {
      if (!teamId) continue;
      if (!inPhase.has(teamId)) throw badRequest("Todos los equipos de los cruces deben participar en la fase");
      if (used.has(teamId)) throw badRequest("Un equipo no puede estar en dos cruces de la misma ronda");
      used.add(teamId);
    }
  }

  await Tie.deleteMany({ phaseId: phase._id, roundId: round._id });
  if (ties.length > 0) {
    await Tie.insertMany(
      ties.map((tie, index) => ({
        championshipId: phase.championshipId,
        phaseId: phase._id,
        roundId: round._id,
        position: index + 1,
        homeTeamId: tie.homeTeamId,
        awayTeamId: tie.awayTeamId ?? undefined,
        winnerTeamId: tie.awayTeamId ? undefined : tie.homeTeamId, // a bye advances by itself
      }))
    );
  }
  await recordAudit(actor, { action: "update", entityType: "tie", entityId: phase._id, championshipId: phase.championshipId, summary: `Cruces de ${round.name}: ${ties.length}`, changes: { round: round.name, ties: ties.length } });
  return getBracket(phaseId);
}

/** The organizer decides who advances (or clears the decision with null). */
export async function setWinner(actor: Actor, tieId: string, teamId: string | null) {
  const tie = await Tie.findById(tieId);
  if (!tie) throw notFound("Cruce no encontrado");
  if (!tie.awayTeamId) throw conflict("Un cruce con descanso avanza automáticamente", "tie_is_bye");
  if (teamId && teamId !== tie.homeTeamId.toString() && teamId !== tie.awayTeamId.toString()) {
    throw badRequest("El ganador debe ser uno de los equipos del cruce");
  }
  tie.winnerTeamId = teamId ? (teamId as unknown as Types.ObjectId) : undefined;
  await tie.save();
  await recordAudit(actor, { action: "update", entityType: "tie", entityId: tie._id, championshipId: tie.championshipId, summary: teamId ? "Ganador del cruce definido" : "Ganador del cruce borrado", changes: { winnerTeamId: teamId } });
  return tie;
}

// ---------- Matches of a tie ----------

const legLabel = (round: IPhaseRound, leg: 1 | 2) => (round.legs === 2 ? `${round.name} · ${leg === 1 ? "Ida" : "Vuelta"}` : round.name);

/** Adds one match of a tie by hand. Leg 2 swaps the home team. Day and time are optional (set them later). */
export async function createTieMatch(actor: Actor, tieId: string, input: { leg: 1 | 2; scheduledAt?: Date; venue?: string }) {
  const tie = await Tie.findById(tieId).lean();
  if (!tie) throw notFound("Cruce no encontrado");
  if (!tie.awayTeamId) throw conflict("Un cruce con descanso no tiene partidos", "tie_is_bye");
  const phase = await Phase.findById(tie.phaseId).lean();
  const round = phase?.rounds.find((entry) => entry._id.equals(tie.roundId));
  if (!phase || !round) throw notFound("Ronda no encontrada");
  if (input.leg > round.legs) throw badRequest("La ronda es a partido único");
  if (await Match.exists({ tieId: tie._id, leg: input.leg })) throw conflict("Ese partido del cruce ya existe", "duplicate");

  const [home, away] = input.leg === 1 ? [tie.homeTeamId, tie.awayTeamId] : [tie.awayTeamId, tie.homeTeamId];
  const matchday = await ensureKnockoutMatchday(phase, round._id, input.leg, legLabel(round, input.leg));
  const match = await Match.create({
    championshipId: tie.championshipId,
    phaseId: tie.phaseId,
    matchdayId: matchday._id,
    tieId: tie._id,
    leg: input.leg,
    homeTeamId: home,
    awayTeamId: away,
    scheduledAt: input.scheduledAt,
    venue: input.venue ?? "",
  });
  await recordAudit(actor, { action: "create", entityType: "match", entityId: match._id, championshipId: tie.championshipId, summary: `Partido de cruce creado: ${legLabel(round, input.leg)}` });
  return match;
}

export interface RoundFixtureOptions {
  /** Also delete the scheduled matches without attendance before creating (their days and times are lost). */
  replaceScheduled: boolean;
  /** Only compute the matches; nothing is saved. */
  preview: boolean;
}

/**
 * Creates the matches of every tie of a round (all first legs, then all second legs), without day or
 * time: the organizer sets them later. Optional helper: each match can also be added by hand.
 * Existing matches are kept; only the missing ones are added unless replacing is requested.
 */
export async function generateRoundFixture(actor: Actor, phaseId: string, roundId: string, options: RoundFixtureOptions) {
  const phase = await loadKnockout(phaseId);
  const round = findRound(phase, roundId);
  const ties = await Tie.find({ phaseId: phase._id, roundId: round._id }).sort({ position: 1 }).lean();
  const playable = ties.filter((tie) => tie.awayTeamId);
  if (playable.length === 0) throw badRequest("Define los cruces de la ronda antes de crear sus partidos");

  const existing = await Match.find({ tieId: { $in: playable.map((tie) => tie._id) } }).select("tieId leg status").lean();
  const scheduled = existing.filter((match) => match.status === "scheduled");
  const withAttendance = new Set(
    (await PlayerCheckIn.distinct("matchId", { matchId: { $in: scheduled.map((match) => match._id) }, status: { $ne: "pending" } })).map(String)
  );
  const replaceable = scheduled.filter((match) => !withAttendance.has(match._id.toString()));
  const replaceableIds = new Set(replaceable.map((match) => match._id.toString()));
  const kept = existing.filter((match) => !(options.replaceScheduled && replaceableIds.has(match._id.toString())));
  const keptKeys = new Set(kept.map((match) => `${match.tieId}:${match.leg}`));

  const legs: (1 | 2)[] = round.legs === 2 ? [1, 2] : [1];
  const parsed = legs.flatMap((leg) =>
    playable
      .filter((tie) => !keptKeys.has(`${tie._id}:${leg}`))
      .map((tie) => ({
        leg,
        tieId: tie._id.toString(),
        homeTeamId: (leg === 1 ? tie.homeTeamId : tie.awayTeamId!).toString(),
        awayTeamId: (leg === 1 ? tie.awayTeamId! : tie.homeTeamId).toString(),
      }))
  );
  if (parsed.length === 0) {
    if (options.preview) return { matches: [], byes: [], rounds: 0, roundLabels: {}, replaceable: replaceable.length, kept: kept.length, created: 0 };
    throw badRequest("No hay partidos nuevos por crear: los de esta ronda ya existen");
  }

  const teams = await Team.find({ _id: { $in: playable.flatMap((tie) => [tie.homeTeamId, tie.awayTeamId!]) } }).select("name").lean();
  const teamName = new Map(teams.map((team) => [team._id.toString(), team.name]));
  const result = {
    matches: parsed.map((match) => ({
      round: match.leg,
      group: round.name,
      homeTeam: { _id: match.homeTeamId, name: teamName.get(match.homeTeamId) ?? "" },
      awayTeam: { _id: match.awayTeamId, name: teamName.get(match.awayTeamId) ?? "" },
    })),
    byes: [],
    rounds: new Set(parsed.map((match) => match.leg)).size,
    roundLabels: Object.fromEntries(legs.map((leg) => [leg, round.legs === 2 ? (leg === 1 ? "Ida" : "Vuelta") : "Partido único"])),
    replaceable: replaceable.length,
    kept: kept.length,
  };
  if (options.preview) return { ...result, created: 0 };

  if (options.replaceScheduled && replaceable.length > 0) {
    const ids = replaceable.map((match) => match._id);
    await PlayerCheckIn.deleteMany({ matchId: { $in: ids } });
    await MatchCallUp.deleteMany({ matchId: { $in: ids } });
    await Match.deleteMany({ _id: { $in: ids } });
  }
  const matchdayByLeg = new Map<number, Types.ObjectId>();
  for (const leg of new Set(parsed.map((match) => match.leg))) {
    matchdayByLeg.set(leg, (await ensureKnockoutMatchday(phase, round._id, leg, legLabel(round, leg)))._id);
  }
  await Match.insertMany(
    parsed.map((match) => ({
      championshipId: phase.championshipId,
      phaseId: phase._id,
      matchdayId: matchdayByLeg.get(match.leg),
      tieId: match.tieId,
      leg: match.leg,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
    }))
  );
  await recordAudit(actor, { action: "update", entityType: "phase", entityId: phase._id, championshipId: phase.championshipId, summary: `Partidos creados: ${round.name} (${parsed.length}), sin día ni hora`, changes: { matches: parsed.length } });
  return { ...result, created: parsed.length };
}

// ---------- Bracket ----------

/** Rounds with their ties, matches, aggregate score and a suggested winner (never applied by itself). */
export async function getBracket(phaseId: string) {
  const phase = await Phase.findById(phaseId).lean();
  if (!phase) throw notFound("Fase no encontrada");
  if (phase.type !== "knockout") throw badRequest("Esta fase no es una eliminatoria");

  const [ties, teams] = await Promise.all([
    Tie.find({ phaseId }).sort({ position: 1 }).lean(),
    Team.find({ championshipId: phase.championshipId }).select("name shieldUrl").lean(),
  ]);
  const matches = await Match.find({ tieId: { $in: ties.map((tie) => tie._id) } }).sort({ leg: 1, scheduledAt: 1 }).lean();
  const team = new Map(teams.map((entry) => [entry._id.toString(), { _id: entry._id.toString(), name: entry.name, shieldUrl: entry.shieldUrl }]));
  const toTeam = (id?: Types.ObjectId) => (id ? team.get(id.toString()) ?? null : null);

  const rounds = [...phase.rounds]
    .sort((a, b) => a.order - b.order)
    .map((round) => ({
      _id: round._id.toString(),
      name: round.name,
      order: round.order,
      legs: round.legs,
      ties: ties
        .filter((tie: ITie) => tie.roundId.equals(round._id))
        .map((tie) => {
          const tieMatches = matches.filter((match) => match.tieId?.equals(tie._id));
          const results = tieMatches.map((match) => ({
            homeTeamId: match.homeTeamId.toString(), awayTeamId: match.awayTeamId.toString(), homeScore: match.homeScore, awayScore: match.awayScore, status: match.status,
          }));
          const away = tie.awayTeamId?.toString();
          const aggregate = away ? aggregateScore(results, tie.homeTeamId.toString(), away) : null;
          return {
            _id: tie._id.toString(),
            position: tie.position,
            homeTeam: toTeam(tie.homeTeamId),
            awayTeam: toTeam(tie.awayTeamId),
            bye: !tie.awayTeamId,
            winnerTeamId: tie.winnerTeamId?.toString() ?? null,
            aggregate: aggregate && { home: aggregate.teamA, away: aggregate.teamB, played: aggregate.played },
            suggestedWinnerTeamId: away ? suggestWinner(results, round.legs, tie.homeTeamId.toString(), away) : null,
            matches: tieMatches.map((match) => ({
              _id: match._id.toString(), leg: match.leg ?? 1, status: match.status, scheduledAt: match.scheduledAt, venue: match.venue,
              homeTeamId: match.homeTeamId.toString(), awayTeamId: match.awayTeamId.toString(), homeScore: match.homeScore ?? null, awayScore: match.awayScore ?? null,
            })),
          };
        }),
    }));
  return { phase: { _id: phase._id.toString(), name: phase.name, championshipId: phase.championshipId.toString(), teamIds: phase.teamIds.map(String) }, rounds };
}

import { badRequest, conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { diffChanges, recordAudit } from "@/lib/audit";
import { assertMatchFitsPhase } from "@/lib/services/phases";
import { serveSuspensions } from "@/lib/services/suspensions";
import { Championship, DEFAULT_RULES } from "@/models/Championship";
import { Matchday } from "@/models/Matchday";
import { matchUpdateSchema } from "@/lib/validation/schemas";
import { IMatch, Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { Referee } from "@/models/Referee";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const match = await Match.findById(id)
    .populate({ path: "phaseId", select: "name type" })
    .populate({ path: "matchdayId", select: "name number" })
    .populate({ path: "homeTeamId", select: "name shieldUrl primaryColor" })
    .populate({ path: "awayTeamId", select: "name shieldUrl primaryColor" })
    .populate({ path: "refereeId", select: "fullName" })
    .populate({ path: "walkoverWinnerTeamId", select: "name shieldUrl" })
    .lean();
  if (!match) throw notFound("Partido no encontrado");
  const [calledUp, present] = await Promise.all([
    MatchCallUp.countDocuments({ matchId: id }),
    PlayerCheckIn.countDocuments({ matchId: id, status: "present" }),
  ]);
  return json({ ...match, counts: { calledUp, present } });
});

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const input = await parseBody(request, matchUpdateSchema);
  const match = await Match.findById(id);
  if (!match) throw notFound("Partido no encontrado");
  await requireOrganizerOfChampionship(actor, match.championshipId);

  const before = match.toObject() as IMatch;
  if (match.tieId && (input.matchdayId !== undefined || input.group !== undefined)) {
    throw conflict("Este partido pertenece a un cruce de eliminatoria; no se puede mover de fecha", "match_in_tie");
  }
  const { matchdayId, group: requestedGroup, ...fields } = input;
  if (fields.refereeId && !(await Referee.exists({ _id: fields.refereeId, championshipId: match.championshipId }))) throw badRequest("El árbitro no pertenece a este campeonato");
  match.set(fields);
  if (fields.refereeId === null) match.set("refereeId", undefined); // referee removed
  if (fields.scheduledAt === null) match.set("scheduledAt", undefined); // back to "unscheduled"
  if (matchdayId !== undefined || requestedGroup !== undefined) {
    const matchday = await Matchday.findById(matchdayId ?? match.matchdayId).select("phaseId championshipId").lean();
    if (!matchday) throw notFound("Fecha no encontrada");
    const nextGroup = requestedGroup === undefined ? match.group : requestedGroup ?? undefined;
    const fit = await assertMatchFitsPhase({
      phaseId: matchday.phaseId.toString(), homeTeamId: match.homeTeamId.toString(), awayTeamId: match.awayTeamId.toString(), group: nextGroup,
    });
    if (matchday.championshipId.toString() !== match.championshipId.toString()) throw badRequest("La fecha debe ser del mismo campeonato del partido");
    match.set({ matchdayId: matchday._id, phaseId: matchday.phaseId, group: fit.group });
  }

  let justFinished = false;
  if (match.status === "walkover") {
    const winnerId = match.walkoverWinnerTeamId?.toString();
    if (!winnerId) throw badRequest("Selecciona el equipo ganador del W.O.");
    if (winnerId !== match.homeTeamId.toString() && winnerId !== match.awayTeamId.toString()) {
      throw badRequest("El ganador debe ser uno de los equipos del partido");
    }
    const championship = await Championship.findById(match.championshipId).select("rules.walkoverGoals").lean();
    const goals = championship?.rules?.walkoverGoals ?? DEFAULT_RULES.walkoverGoals;
    const homeWins = winnerId === match.homeTeamId.toString();
    match.set({
      homeScore: homeWins ? goals : 0,
      awayScore: homeWins ? 0 : goals,
      finishedAt: match.finishedAt ?? new Date(),
    });
  } else {
    if (before.status === "walkover") {
      // Reverted away from walkover: the derived result no longer applies.
      match.set({ walkoverWinnerTeamId: undefined, homeScore: undefined, awayScore: undefined, finishedAt: undefined });
    }
    // The running clock (start/half time/finish, via /transition) is optional: picking "En vivo" or
    // "Finalizado" straight from this form skips it, so the period just needs to make sense for display.
    if (match.status === "live" && match.period === "not_started") {
      match.period = "first_half";
    } else if (match.status === "finished") {
      if (!match.finishedAt) match.finishedAt = new Date();
      match.period = "finished";
      justFinished = before.status !== "finished";
    } else if ((before.status === "live" || before.status === "finished") && !["live", "finished"].includes(match.status)) {
      // Reverted back to an earlier state (e.g. fixing a mistake): the clock resets, the recorded goals/cards don't.
      match.set({ period: "not_started", startedAt: undefined, periodStartedAt: undefined, finishedAt: undefined });
    }
  }
  await match.save();
  if (justFinished) await serveSuspensions(actor, match);

  const { scheduledAt: requestedDate, refereeId: _referee, walkoverWinnerTeamId: _winner, ...otherFields } = fields;
  void _referee; // the referee is audited through its own summary below
  void _winner; // ObjectId vs string; the walkover outcome is audited through the status/score change itself
  const patch: Partial<IMatch> = { ...otherFields, ...(requestedDate !== undefined ? { scheduledAt: requestedDate ?? undefined } : {}) };
  const changes = diffChanges(before, patch, [
    "scheduledAt", "venue", "status",
  ]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action: "update",
      entityType: "match",
      entityId: match._id,
      championshipId: match.championshipId,
      summary: "Partido actualizado",
      changes,
    });
  }
  return json(match);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const match = await Match.findById(id);
  if (!match) throw notFound("Partido no encontrado");
  await requireOrganizerOfChampionship(actor, match.championshipId);
  if (match.status !== "scheduled") {
    throw conflict("Solo se pueden eliminar partidos programados", "match_not_deletable");
  }
  const hasAttendance = await PlayerCheckIn.exists({ matchId: id, status: { $ne: "pending" } });
  if (hasAttendance) throw conflict("El partido ya tiene asistencia registrada", "match_has_attendance");

  await PlayerCheckIn.deleteMany({ matchId: id });
  await MatchCallUp.deleteMany({ matchId: id });
  await match.deleteOne();
  await recordAudit(actor, {
    action: "delete",
    entityType: "match",
    entityId: match._id,
    championshipId: match.championshipId,
    summary: "Partido eliminado",
  });
  return json({ ok: true });
});

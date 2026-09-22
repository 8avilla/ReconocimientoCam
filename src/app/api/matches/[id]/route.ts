import { badRequest, conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { diffChanges, recordAudit } from "@/lib/audit";
import { assertMatchFitsPhase } from "@/lib/services/phases";
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

  if (input.status && (match.status === "live" || match.status === "finished")) {
    throw conflict("El estado de un partido en juego o finalizado se cambia desde la gestión del partido", "use_transitions");
  }

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
  await match.save();

  const { scheduledAt: requestedDate, refereeId: _referee, ...otherFields } = fields;
  void _referee; // the referee is audited through its own summary below
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

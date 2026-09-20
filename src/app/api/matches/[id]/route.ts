import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { diffChanges, recordAudit } from "@/lib/audit";
import { matchUpdateSchema } from "@/lib/validation/schemas";
import { IMatch, Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const match = await Match.findById(id)
    .populate({ path: "homeTeamId", select: "name shieldUrl primaryColor" })
    .populate({ path: "awayTeamId", select: "name shieldUrl primaryColor" })
    .lean();
  if (!match) throw notFound("Partido no encontrado");
  const [calledUp, present] = await Promise.all([
    MatchCallUp.countDocuments({ matchId: id }),
    PlayerCheckIn.countDocuments({ matchId: id, status: "present" }),
  ]);
  return json({ ...match, counts: { calledUp, present } });
});

export const PATCH = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, matchUpdateSchema);
  const match = await Match.findById(id);
  if (!match) throw notFound("Partido no encontrado");

  if (input.status && (match.status === "live" || match.status === "finished")) {
    throw conflict("El estado de un partido en juego o finalizado se cambia desde la gestión del partido", "use_transitions");
  }

  const before = match.toObject() as IMatch;
  match.set(input);
  await match.save();

  const changes = diffChanges(before, input, [
    "scheduledAt", "venue", "round", "status",
  ]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(getActor(request), {
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
  const match = await Match.findById(id);
  if (!match) throw notFound("Partido no encontrado");
  if (match.status !== "scheduled") {
    throw conflict("Solo se pueden eliminar partidos programados", "match_not_deletable");
  }
  const hasAttendance = await PlayerCheckIn.exists({ matchId: id, status: { $ne: "pending" } });
  if (hasAttendance) throw conflict("El partido ya tiene asistencia registrada", "match_has_attendance");

  await PlayerCheckIn.deleteMany({ matchId: id });
  await MatchCallUp.deleteMany({ matchId: id });
  await match.deleteOne();
  await recordAudit(getActor(request), {
    action: "delete",
    entityType: "match",
    entityId: match._id,
    championshipId: match.championshipId,
    summary: "Partido eliminado",
  });
  return json({ ok: true });
});

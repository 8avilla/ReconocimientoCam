import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { diffChanges, recordAudit } from "@/lib/audit";
import { deleteImage } from "@/lib/azureBlob";
import { teamUpdateSchema } from "@/lib/validation/schemas";
import { Match } from "@/models/Match";
import { Phase } from "@/models/Phase";
import { ITeam, Team } from "@/models/Team";
import { LIVE_REGISTRATION_STATUSES, TeamRegistration } from "@/models/TeamRegistration";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const team = await Team.findById(id).lean();
  if (!team) throw notFound("Equipo no encontrado");
  const playerCount = await TeamRegistration.countDocuments({
    teamId: id,
    status: { $in: LIVE_REGISTRATION_STATUSES },
  });
  return json({ ...team, playerCount });
});

export const PATCH = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const input = await parseBody(request, teamUpdateSchema);
  const team = await Team.findById(id);
  if (!team) throw notFound("Equipo no encontrado");
  await requireOrganizerOfChampionship(actor, team.championshipId);

  if (input.name && input.name !== team.name) {
    const duplicate = await Team.exists({ championshipId: team.championshipId, name: input.name, _id: { $ne: team._id } });
    if (duplicate) throw conflict("Ya existe un equipo con ese nombre en el campeonato", "duplicate");
  }

  const before = team.toObject() as ITeam;
  team.set(input);
  await team.save();

  const changes = diffChanges(before, input, ["name", "delegateName", "primaryColor", "secondaryColor", "active"]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action: "update",
      entityType: "team",
      entityId: team._id,
      championshipId: team.championshipId,
      summary: `Equipo actualizado: ${team.name}`,
      changes,
    });
  }
  return json(team);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const actor = getActor(request);
  const team = await Team.findById(id);
  if (!team) throw notFound("Equipo no encontrado");
  await requireOrganizerOfChampionship(actor, team.championshipId);

  if (await Phase.exists({ teamIds: team._id })) {
    throw conflict("El equipo participa en una fase; quítalo de la fase primero", "team_in_phase");
  }
  const [registrations, matches] = await Promise.all([
    TeamRegistration.exists({ teamId: id }),
    Match.exists({ $or: [{ homeTeamId: id }, { awayTeamId: id }] }),
  ]);
  if (registrations || matches) {
    throw conflict("El equipo tiene jugadores o partidos; desactívalo en lugar de eliminarlo", "team_in_use");
  }
  await team.deleteOne();
  if (team.shieldBlobName) {
    await deleteImage(team.shieldBlobName).catch((error) => console.error("Failed to delete shield image:", error));
  }
  await recordAudit(actor, {
    action: "delete",
    entityType: "team",
    entityId: team._id,
    championshipId: team.championshipId,
    summary: `Equipo eliminado: ${team.name}`,
  });
  return json({ ok: true });
});

import { conflict, escapeRegex, json, notFound, parseBody, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { teamCreateSchema, teamListQuery } from "@/lib/validation/schemas";
import { skipFor } from "@/lib/validation/common";
import { Championship } from "@/models/Championship";
import { ITeam, Team } from "@/models/Team";
import { LIVE_REGISTRATION_STATUSES, TeamRegistration } from "@/models/TeamRegistration";

export const GET = route(async (request) => {
  const query = parseQuery(request, teamListQuery);
  const filter = {
    ...(query.championshipId ? { championshipId: toObjectId(query.championshipId) } : {}),
    ...(query.q ? { name: { $regex: escapeRegex(query.q), $options: "i" } } : {}),
    ...(query.active ? { active: query.active === "true" } : {}),
  };
  const [teams, total] = await Promise.all([
    Team.find(filter).sort({ name: 1 }).skip(skipFor(query)).limit(query.limit).lean(),
    Team.countDocuments(filter),
  ]);

  const counts = await TeamRegistration.aggregate<{ _id: ITeam["_id"]; count: number }>([
    { $match: { teamId: { $in: teams.map((team) => team._id) }, status: { $in: LIVE_REGISTRATION_STATUSES } } },
    { $group: { _id: "$teamId", count: { $sum: 1 } } },
  ]);
  const countByTeam = new Map(counts.map((row) => [row._id.toString(), row.count]));

  const data = teams.map((team) => ({ ...team, playerCount: countByTeam.get(team._id.toString()) ?? 0 }));
  const body: Paginated<(typeof data)[number]> = { data, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

export const POST = route(async (request) => {
  const input = await parseBody(request, teamCreateSchema);
  const championship = await Championship.exists({ _id: input.championshipId });
  if (!championship) throw notFound("Campeonato no encontrado");

  const duplicate = await Team.exists({ championshipId: input.championshipId, name: input.name });
  if (duplicate) throw conflict("Ya existe un equipo con ese nombre en el campeonato", "duplicate");

  const team = await Team.create(input);
  await recordAudit(getActor(request), {
    action: "create",
    entityType: "team",
    entityId: team._id,
    championshipId: team.championshipId,
    summary: `Equipo creado: ${team.name}`,
  });
  return json(team, 201);
});

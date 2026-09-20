import { badRequest, json, notFound, parseBody, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { syncMatchCallUps } from "@/lib/services/callups";
import { skipFor } from "@/lib/validation/common";
import { matchCreateSchema, matchListQuery } from "@/lib/validation/schemas";
import { Championship } from "@/models/Championship";
import { IMatch, Match } from "@/models/Match";
import { Team } from "@/models/Team";

export const GET = route(async (request) => {
  const query = parseQuery(request, matchListQuery);
  const filter = {
    ...(query.championshipId ? { championshipId: toObjectId(query.championshipId) } : {}),
    ...(query.teamId
      ? { $or: [{ homeTeamId: toObjectId(query.teamId) }, { awayTeamId: toObjectId(query.teamId) }] }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? { scheduledAt: { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) } }
      : {}),
  };
  const [data, total] = await Promise.all([
    Match.find(filter)
      .sort({ scheduledAt: 1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .populate({ path: "homeTeamId", select: "name shieldUrl" })
      .populate({ path: "awayTeamId", select: "name shieldUrl" })
      .lean(),
    Match.countDocuments(filter),
  ]);
  const body: Paginated<IMatch> = { data: data as unknown as IMatch[], meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

export const POST = route(async (request) => {
  const input = await parseBody(request, matchCreateSchema);
  const championship = await Championship.exists({ _id: input.championshipId });
  if (!championship) throw notFound("Campeonato no encontrado");

  const teams = await Team.find({ _id: { $in: [input.homeTeamId, input.awayTeamId] } }).lean();
  if (teams.length !== 2) throw notFound("Alguno de los equipos no existe");
  if (teams.some((team) => team.championshipId.toString() !== input.championshipId)) {
    throw badRequest("Los equipos deben pertenecer al campeonato del partido");
  }
  const match = await Match.create(input);
  // The whole squad of both teams is called up automatically.
  await syncMatchCallUps(match._id.toString());
  const names = teams.map((team) => team.name).join(" vs ");
  await recordAudit(getActor(request), {
    action: "create",
    entityType: "match",
    entityId: match._id,
    championshipId: match.championshipId,
    summary: `Partido creado: ${names}`,
  });
  return json(match, 201);
});

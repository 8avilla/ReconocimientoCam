import { json, notFound, parseBody, parseQuery, route, toObjectId } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { refereeCreateSchema, refereeListQuery } from "@/lib/validation/schemas";
import { Championship } from "@/models/Championship";
import { Match } from "@/models/Match";
import { Referee } from "@/models/Referee";

export const GET = route(async (request) => {
  const query = parseQuery(request, refereeListQuery);
  const filter = { championshipId: toObjectId(query.championshipId), ...(query.active ? { active: query.active === "true" } : {}) };
  const referees = await Referee.find(filter).sort({ fullName: 1 }).lean();
  // How many matches each one has (to show workload and to know whether it can be deleted).
  const counts = await Match.aggregate<{ _id: unknown; count: number }>([
    { $match: { championshipId: filter.championshipId, refereeId: { $in: referees.map((referee) => referee._id) } } },
    { $group: { _id: "$refereeId", count: { $sum: 1 } } },
  ]);
  const countBy = new Map(counts.map((row) => [String(row._id), row.count]));
  return json({ data: referees.map((referee) => ({ ...referee, matchCount: countBy.get(referee._id.toString()) ?? 0 })) });
});

export const POST = route(async (request) => {
  const input = await parseBody(request, refereeCreateSchema);
  if (!(await Championship.exists({ _id: input.championshipId }))) throw notFound("Campeonato no encontrado");
  const referee = await Referee.create(input);
  await recordAudit(getActor(request), { action: "create", entityType: "referee", entityId: referee._id, championshipId: referee.championshipId, summary: `Árbitro creado: ${referee.fullName}` });
  return json(referee, 201);
});

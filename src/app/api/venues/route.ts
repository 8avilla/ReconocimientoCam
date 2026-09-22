import { conflict, json, notFound, parseBody, parseQuery, route, toObjectId } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { venueCreateSchema, venueListQuery } from "@/lib/validation/schemas";
import { Championship } from "@/models/Championship";
import { Match } from "@/models/Match";
import { Venue } from "@/models/Venue";

export const GET = route(async (request) => {
  const query = parseQuery(request, venueListQuery);
  const filter = { championshipId: toObjectId(query.championshipId), ...(query.active ? { active: query.active === "true" } : {}) };
  const venues = await Venue.find(filter).sort({ name: 1 }).lean();
  // Matches keep the venue as text, so usage is counted by name.
  const counts = await Match.aggregate<{ _id: string; count: number }>([
    { $match: { championshipId: filter.championshipId, venue: { $in: venues.map((venue) => venue.name) } } },
    { $group: { _id: "$venue", count: { $sum: 1 } } },
  ]);
  const countBy = new Map(counts.map((row) => [row._id, row.count]));
  return json({ data: venues.map((venue) => ({ ...venue, matchCount: countBy.get(venue.name) ?? 0 })) });
});

export const POST = route(async (request) => {
  const actor = getActor(request);
  const input = await parseBody(request, venueCreateSchema);
  if (!(await Championship.exists({ _id: input.championshipId }))) throw notFound("Campeonato no encontrado");
  await requireOrganizerOfChampionship(actor, input.championshipId);
  if (await Venue.exists({ championshipId: input.championshipId, name: input.name })) throw conflict("Ya existe un sitio con ese nombre", "duplicate");
  const venue = await Venue.create(input);
  await recordAudit(actor, { action: "create", entityType: "venue", entityId: venue._id, championshipId: venue.championshipId, summary: `Sitio creado: ${venue.name}` });
  return json(venue, 201);
});

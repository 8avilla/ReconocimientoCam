import { json, parseBody, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createRegistration } from "@/lib/services/registrations";
import { skipFor } from "@/lib/validation/common";
import { registrationCreateSchema, registrationListQuery } from "@/lib/validation/schemas";
import { ITeamRegistration, TeamRegistration } from "@/models/TeamRegistration";

export const GET = route(async (request) => {
  const query = parseQuery(request, registrationListQuery);
  const filter = {
    ...(query.championshipId ? { championshipId: toObjectId(query.championshipId) } : {}),
    ...(query.teamId ? { teamId: toObjectId(query.teamId) } : {}),
    ...(query.playerId ? { playerId: toObjectId(query.playerId) } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [data, total] = await Promise.all([
    TeamRegistration.find(filter).sort({ shirtNumber: 1 }).skip(skipFor(query)).limit(query.limit).lean(),
    TeamRegistration.countDocuments(filter),
  ]);
  const body: Paginated<ITeamRegistration> = { data, meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

export const POST = route(async (request) => {
  const input = await parseBody(request, registrationCreateSchema);
  const registration = await createRegistration(getActor(request), input);
  return json(registration, 201);
});

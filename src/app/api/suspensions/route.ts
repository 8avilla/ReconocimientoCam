import { json, parseBody, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createManualSuspension } from "@/lib/services/suspensions";
import { skipFor } from "@/lib/validation/common";
import { suspensionCreateSchema, suspensionListQuery } from "@/lib/validation/schemas";
import { ISuspension, Suspension } from "@/models/Suspension";

export const GET = route(async (request) => {
  const query = parseQuery(request, suspensionListQuery);
  const filter = {
    ...(query.championshipId ? { championshipId: toObjectId(query.championshipId) } : {}),
    ...(query.teamId ? { teamId: toObjectId(query.teamId) } : {}),
    ...(query.playerId ? { playerId: toObjectId(query.playerId) } : {}),
    ...(query.matchId ? { sourceMatchId: toObjectId(query.matchId) } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [data, total] = await Promise.all([
    Suspension.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(query))
      .limit(query.limit)
      .populate({ path: "playerId", select: "fullName photoUrl publicId" })
      .populate({ path: "teamId", select: "name shieldUrl" })
      .lean(),
    Suspension.countDocuments(filter),
  ]);
  const body: Paginated<ISuspension> = { data: data as unknown as ISuspension[], meta: { page: query.page, limit: query.limit, total } };
  return json(body);
});

/** Manual suspension decided by the organizers. */
export const POST = route(async (request) => {
  const { registrationId, matches, note } = await parseBody(request, suspensionCreateSchema);
  return json(await createManualSuspension(getActor(request), registrationId, matches, note), 201);
});

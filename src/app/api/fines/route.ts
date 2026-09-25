import { json, parseBody, parseQuery, route, toObjectId, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createManualFine, ensureRegistrationFines, listFines } from "@/lib/services/fines";
import { skipFor } from "@/lib/validation/common";
import { fineCreateSchema, fineListQuery } from "@/lib/validation/schemas";
import { Championship } from "@/models/Championship";

/** Fines of a championship with the money summary (owed / collected, and what each team owes). */
export const GET = route(async (request) => {
  const query = parseQuery(request, fineListQuery);
  if (query.type === "registration") {
    // Backfills any team missing its registration fine (joined before the fee existed, or before it was raised above 0).
    const championship = await Championship.findById(query.championshipId).select("rules.registrationFeeAmount").lean();
    if (championship) await ensureRegistrationFines(getActor(request), toObjectId(query.championshipId), championship.rules.registrationFeeAmount);
  }
  const { data, total, summary } = await listFines({ ...query, skip: skipFor(query) });
  const body: Paginated<unknown> & { summary: typeof summary } = { data, meta: { page: query.page, limit: query.limit, total }, summary };
  return json(body);
});

export const POST = route(async (request) => {
  const input = await parseBody(request, fineCreateSchema);
  return json(await createManualFine(getActor(request), input), 201);
});

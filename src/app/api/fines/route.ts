import { json, parseBody, parseQuery, route, Paginated } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createManualFine, listFines } from "@/lib/services/fines";
import { skipFor } from "@/lib/validation/common";
import { fineCreateSchema, fineListQuery } from "@/lib/validation/schemas";

/** Fines of a championship with the money summary (owed / collected, and what each team owes). */
export const GET = route(async (request) => {
  const query = parseQuery(request, fineListQuery);
  const { data, total, summary } = await listFines({ ...query, skip: skipFor(query) });
  const body: Paginated<unknown> & { summary: typeof summary } = { data, meta: { page: query.page, limit: query.limit, total }, summary };
  return json(body);
});

export const POST = route(async (request) => {
  const input = await parseBody(request, fineCreateSchema);
  return json(await createManualFine(getActor(request), input), 201);
});

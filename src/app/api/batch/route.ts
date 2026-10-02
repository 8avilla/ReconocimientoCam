import { json, parseBody, route } from "@/lib/api";
import { expandTemplates } from "@/lib/batch";
import { findChampionshipByIdOrSlug } from "@/lib/services/championships";
import { runBatch } from "@/lib/services/batch";
import { batchSchema } from "@/lib/validation/schemas";

/**
 * Several reads in one request (see `lib/batch.ts`). Body: `{ paths: ["/matches/…", …], championship?: "<id or slug>" }`;
 * `:cid` and `:route` in a path stand for that championship's real id and for what was given. Returns
 * `{ results: { "<path>": { status, body } } }`, including the answers the screen will ask for next.
 */
export const POST = route(async (request) => {
  const { paths, championship } = await parseBody(request, batchSchema);
  const found = championship ? await findChampionshipByIdOrSlug(championship).select("_id").lean() : null;
  const expanded = expandTemplates(paths, found ? { id: found._id.toString(), route: championship! } : null);
  const origin = new URL(request.url).origin;
  return json({ results: await runBatch(expanded, origin, request.headers) });
});

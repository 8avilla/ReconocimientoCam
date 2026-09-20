import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { transitionMatch } from "@/lib/services/matchEvents";
import { matchTransitionSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Start, half time, second half and end of the match. */
export const POST = route<Params>(async (request, { id }) => {
  const { action, force, reason } = await parseBody(request, matchTransitionSchema);
  return json(await transitionMatch(getActor(request), id, action, { force, reason }));
});

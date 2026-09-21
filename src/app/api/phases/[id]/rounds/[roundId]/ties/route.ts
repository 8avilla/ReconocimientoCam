import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { setTies } from "@/lib/services/knockout";
import { tiesSchema } from "@/lib/validation/schemas";

type Params = { id: string; roundId: string };

/** Replaces the ties of a round with the ones sent (by hand or taken from a proposal). */
export const PUT = route<Params>(async (request, { id, roundId }) => {
  const { ties } = await parseBody(request, tiesSchema);
  return json(await setTies(getActor(request), id, roundId, ties));
});

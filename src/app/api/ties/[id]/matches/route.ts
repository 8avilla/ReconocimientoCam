import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createTieMatch } from "@/lib/services/knockout";
import { tieMatchSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Adds one match (leg 1 or 2) of a tie by hand. */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, tieMatchSchema);
  return json(await createTieMatch(getActor(request), id, input), 201);
});

import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { setWinner } from "@/lib/services/knockout";
import { winnerSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** The organizer marks who advances (null clears it). The result is only ever a suggestion until then. */
export const PATCH = route<Params>(async (request, { id }) => {
  const { teamId } = await parseBody(request, winnerSchema);
  return json(await setWinner(getActor(request), id, teamId));
});

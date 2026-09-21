import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { setPhaseTeams } from "@/lib/services/phases";
import { phaseTeamsSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Sets the participating teams (and the group distribution of a group phase). */
export const PUT = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, phaseTeamsSchema);
  return json(await setPhaseTeams(getActor(request), id, input));
});

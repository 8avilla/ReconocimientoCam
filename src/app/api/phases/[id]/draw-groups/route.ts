import { json, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { drawPhaseGroups } from "@/lib/services/phases";

type Params = { id: string };

/** Random even draw of the phase teams into its groups. */
export const POST = route<Params>(async (request, { id }) => json(await drawPhaseGroups(getActor(request), id)));

import { json, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { voidEvent } from "@/lib/services/matchEvents";

type Params = { id: string; eventId: string };

/** Voids an event (it stays in the history) and recomputes score and discipline. Needs no body. */
export const POST = route<Params>(async (request, { id, eventId }) => json(await voidEvent(getActor(request), id, eventId)));

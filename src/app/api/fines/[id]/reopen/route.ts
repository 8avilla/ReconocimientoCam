import { json, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { reopenFine } from "@/lib/services/fines";

type Params = { id: string };

export const POST = route<Params>(async (request, { id }) => json(await reopenFine(getActor(request), id)));

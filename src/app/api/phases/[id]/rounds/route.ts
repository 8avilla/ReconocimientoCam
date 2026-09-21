import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { addRound, getBracket } from "@/lib/services/knockout";
import { roundCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Adds a round (e.g. "Semifinal") to a knockout phase; the organizer defines its name and legs. */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, roundCreateSchema);
  await addRound(getActor(request), id, input);
  return json(await getBracket(id), 201);
});

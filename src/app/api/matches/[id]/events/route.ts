import { json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createEvent, listEvents } from "@/lib/services/matchEvents";
import { matchEventCreateSchema } from "@/lib/validation/schemas";
import { Match } from "@/models/Match";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  if (!(await Match.exists({ _id: id }))) throw notFound("Partido no encontrado");
  return json({ data: await listEvents(id) });
});

/** Registers a goal, card, substitution or incident; may generate an automatic red card and suspensions. */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, matchEventCreateSchema);
  return json(await createEvent(getActor(request), id, input), 201);
});

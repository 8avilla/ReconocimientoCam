import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createMatchday, listMatchdays } from "@/lib/services/matchdays";
import { matchdayCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json({ data: await listMatchdays(id) }));

/** Creates a matchday by hand ("Fecha N" unless a name is given). */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, matchdayCreateSchema);
  return json(await createMatchday(getActor(request), id, input), 201);
});

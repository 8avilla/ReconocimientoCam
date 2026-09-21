import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { deleteMatchday, updateMatchday } from "@/lib/services/matchdays";
import { matchdayUpdateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const PATCH = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, matchdayUpdateSchema);
  return json(await updateMatchday(getActor(request), id, input));
});

export const DELETE = route<Params>(async (request, { id }) => {
  await deleteMatchday(getActor(request), id);
  return json({ ok: true });
});

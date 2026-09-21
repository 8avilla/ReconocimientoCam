import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { deleteRound, getBracket, updateRound } from "@/lib/services/knockout";
import { roundUpdateSchema } from "@/lib/validation/schemas";

type Params = { id: string; roundId: string };

export const PATCH = route<Params>(async (request, { id, roundId }) => {
  const input = await parseBody(request, roundUpdateSchema);
  await updateRound(getActor(request), id, roundId, input);
  return json(await getBracket(id));
});

export const DELETE = route<Params>(async (request, { id, roundId }) => {
  await deleteRound(getActor(request), id, roundId);
  return json(await getBracket(id));
});

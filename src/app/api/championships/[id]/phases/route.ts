import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createPhase, listPhases } from "@/lib/services/phases";
import { phaseCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json({ data: await listPhases(id) }));

export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, phaseCreateSchema);
  return json(await createPhase(getActor(request), id, input), 201);
});

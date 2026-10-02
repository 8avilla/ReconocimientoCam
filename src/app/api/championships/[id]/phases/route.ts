import { cached } from "@/lib/serverCache";

const CACHE_MS = 20_000;
import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { createPhase, listPhases } from "@/lib/services/phases";
import { phaseCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => json({ data: await cached(`phases:${id}`, CACHE_MS, () => listPhases(id)) }));

export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, phaseCreateSchema);
  return json(await createPhase(getActor(request), id, input), 201);
});

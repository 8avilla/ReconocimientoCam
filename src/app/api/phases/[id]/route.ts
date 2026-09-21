import { json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { deletePhase, updatePhase } from "@/lib/services/phases";
import { phaseUpdateSchema } from "@/lib/validation/schemas";
import { Phase } from "@/models/Phase";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const phase = await Phase.findById(id).lean();
  if (!phase) throw notFound("Fase no encontrada");
  return json(phase);
});

export const PATCH = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, phaseUpdateSchema);
  return json(await updatePhase(getActor(request), id, input));
});

export const DELETE = route<Params>(async (request, { id }) => {
  await deletePhase(getActor(request), id);
  return json({ ok: true });
});

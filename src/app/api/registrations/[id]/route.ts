import { json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { deleteRegistration, updateRegistration } from "@/lib/services/registrations";
import { registrationUpdateSchema } from "@/lib/validation/schemas";
import { TeamRegistration } from "@/models/TeamRegistration";

type Params = { id: string };

export const GET = route<Params>(async (_request, { id }) => {
  const registration = await TeamRegistration.findById(id).lean();
  if (!registration) throw notFound("Inscripción no encontrada");
  return json(registration);
});

export const PATCH = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, registrationUpdateSchema);
  return json(await updateRegistration(getActor(request), id, input));
});

export const DELETE = route<Params>(async (request, { id }) => {
  await deleteRegistration(getActor(request), id);
  return json({ ok: true });
});

import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { liftSuspension } from "@/lib/services/suspensions";
import { suspensionLiftSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const POST = route<Params>(async (request, { id }) => {
  const { note } = await parseBody(request, suspensionLiftSchema);
  return json(await liftSuspension(getActor(request), id, note));
});

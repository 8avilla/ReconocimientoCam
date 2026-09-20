import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { registerCheckIn } from "@/lib/services/checkins";
import { checkInCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Registers attendance (QR or manual contingency) for a called-up player. */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, checkInCreateSchema);
  return json(await registerCheckIn(getActor(request), id, input), 201);
});

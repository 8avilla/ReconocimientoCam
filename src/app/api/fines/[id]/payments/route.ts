import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { addPayment } from "@/lib/services/fines";
import { finePaymentSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Registers a payment (possibly partial) received for a fine. */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, finePaymentSchema);
  return json(await addPayment(getActor(request), id, input), 201);
});

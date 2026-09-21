import { json, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { removePayment } from "@/lib/services/fines";

type Params = { id: string; paymentId: string };

export const DELETE = route<Params>(async (request, { id, paymentId }) => json(await removePayment(getActor(request), id, paymentId)));

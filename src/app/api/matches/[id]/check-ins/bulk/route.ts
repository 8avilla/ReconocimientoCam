import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { registerBulkCheckIn } from "@/lib/services/checkins";
import { bulkCheckInSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Manual attendance for several players at once (mark a whole squad present, or set/undo specific players). */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, bulkCheckInSchema);
  return json(await registerBulkCheckIn(getActor(request), id, input));
});

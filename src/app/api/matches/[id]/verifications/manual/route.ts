import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { approveManually } from "@/lib/services/verifications";
import { manualReviewSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Manual review: a referee accepts the player's identity when the automatic check is not conclusive. */
export const POST = route<Params>(async (request, { id }) => {
  const { playerId, reason } = await parseBody(request, manualReviewSchema);
  return json(await approveManually(getActor(request), id, playerId, reason), 201);
});

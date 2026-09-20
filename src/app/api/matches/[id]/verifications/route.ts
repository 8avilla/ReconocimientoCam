import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { verifyFace } from "@/lib/services/verifications";
import { verificationCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Facial 1:1 verification of a called-up player against their registered face. */
export const POST = route<Params>(async (request, { id }) => {
  const { playerId, image } = await parseBody(request, verificationCreateSchema);
  return json(await verifyFace(getActor(request), id, playerId, image), 201);
});

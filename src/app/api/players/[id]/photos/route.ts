import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { addPlayerPhoto } from "@/lib/services/players";
import { playerPhotoCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Adds a general photo of the player (identification, posters); unrelated to the biometric face. */
export const POST = route<Params>(async (request, { id }) => {
  const { image } = await parseBody(request, playerPhotoCreateSchema);
  const photo = await addPlayerPhoto(getActor(request), id, image);
  return json(photo, 201);
});

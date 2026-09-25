import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { setPlayerCarnetImage } from "@/lib/services/players";
import { playerPhotoCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Sets the ID card / avatar photo from a raw (already face-cropped) image, without adding it to the general gallery. */
export const POST = route<Params>(async (request, { id }) => {
  const { image } = await parseBody(request, playerPhotoCreateSchema);
  const result = await setPlayerCarnetImage(getActor(request), id, image);
  return json(result);
});

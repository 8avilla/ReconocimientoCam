import { json, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { setPlayerCarnetPhoto } from "@/lib/services/players";

type Params = { id: string; photoId: string };

/** Uses one of the player's general photos as the ID card / avatar photo; never touches the biometric data. */
export const POST = route<Params>(async (request, { id, photoId }) => {
  const result = await setPlayerCarnetPhoto(getActor(request), id, photoId);
  return json(result);
});

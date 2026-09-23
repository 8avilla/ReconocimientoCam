import { json, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { removePlayerPhoto } from "@/lib/services/players";

type Params = { id: string; photoId: string };

/** Removes one general photo of the player. */
export const DELETE = route<Params>(async (request, { id, photoId }) => {
  await removePlayerPhoto(getActor(request), id, photoId);
  return json({ ok: true });
});

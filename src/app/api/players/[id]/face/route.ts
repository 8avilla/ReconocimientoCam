import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { enrollPlayerFace, removePlayerFace } from "@/lib/services/players";
import { faceEnrollSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Registers the official face (photo + embedding) of a player. Replaces any previous one. */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, faceEnrollSchema);
  const result = await enrollPlayerFace(getActor(request), id, input);
  return json(result, 201);
});

/** Removes the photo, embedding and consent of the player. */
export const DELETE = route<Params>(async (request, { id }) => {
  await removePlayerFace(getActor(request), id);
  return json({ ok: true });
});

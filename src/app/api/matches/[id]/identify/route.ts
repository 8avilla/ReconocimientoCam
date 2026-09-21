import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { identifyFace } from "@/lib/services/verifications";
import { imageUploadSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Attendance by camera: identifies the face among both squads and registers the player when the match is clear. */
export const POST = route<Params>(async (request, { id }) => {
  const { image } = await parseBody(request, imageUploadSchema);
  return json(await identifyFace(getActor(request), id, image));
});

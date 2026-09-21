import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { waiveFine } from "@/lib/services/fines";
import { fineNoteSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, fineNoteSchema);
  return json(await waiveFine(getActor(request), id, input.note));
});

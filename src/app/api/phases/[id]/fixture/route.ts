import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { generateFixture } from "@/lib/services/fixture";
import { fixtureSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Generates (or previews) the calendar of one phase following its format. */
export const POST = route<Params>(async (request, { id }) => {
  const options = await parseBody(request, fixtureSchema);
  const result = await generateFixture(getActor(request), id, options);
  return json(result, options.preview ? 200 : 201);
});

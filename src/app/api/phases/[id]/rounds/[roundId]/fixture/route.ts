import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { generateRoundFixture } from "@/lib/services/knockout";
import { fixtureSchema } from "@/lib/validation/schemas";

type Params = { id: string; roundId: string };

/** Optional helper: schedules the matches of all ties of a round (preview or create). */
export const POST = route<Params>(async (request, { id, roundId }) => {
  const options = await parseBody(request, fixtureSchema);
  const result = await generateRoundFixture(getActor(request), id, roundId, options);
  return json(result, options.preview ? 200 : 201);
});

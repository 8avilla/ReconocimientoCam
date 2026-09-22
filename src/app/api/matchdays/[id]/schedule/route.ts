import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { scheduleMatchday } from "@/lib/services/matchdays";
import { matchdayScheduleSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Sets or clears day, time and venue of several matches of the matchday in one request. */
export const PUT = route<Params>(async (request, { id }) => {
  const { matches } = await parseBody(request, matchdayScheduleSchema);
  return json(await scheduleMatchday(getActor(request), id, matches));
});

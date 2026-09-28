import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { addTeamStaffMember } from "@/lib/services/teams";
import { teamStaffCreateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/** Adds a coaching staff member (head coach, assistant, physical trainer, etc.) to the team. */
export const POST = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, teamStaffCreateSchema);
  const team = await addTeamStaffMember(getActor(request), id, input);
  return json(team, 201);
});

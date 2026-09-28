import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { removeTeamStaffMember, updateTeamStaffMember } from "@/lib/services/teams";
import { teamStaffUpdateSchema } from "@/lib/validation/schemas";

type Params = { id: string; staffId: string };

/** Edits a coaching staff member's name or role. */
export const PATCH = route<Params>(async (request, { id, staffId }) => {
  const input = await parseBody(request, teamStaffUpdateSchema);
  const team = await updateTeamStaffMember(getActor(request), id, staffId, input);
  return json(team);
});

/** Removes a coaching staff member from the team. */
export const DELETE = route<Params>(async (request, { id, staffId }) => {
  const team = await removeTeamStaffMember(getActor(request), id, staffId);
  return json(team);
});

import type { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { notFound } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { TEAM_STAFF_ROLE_LABEL } from "@/lib/labels";
import type { TeamStaffRole } from "@/lib/constants";
import { ITeamStaffMember, Team } from "@/models/Team";

/** `staff` is a plain array in the shared `ITeam` type (correct for `.lean()` reads elsewhere); a
 * hydrated document's is really a Mongoose `DocumentArray` with `.id()`/subdocument `push()`. */
const staffOf = (team: { staff: ITeamStaffMember[] }) => team.staff as unknown as Types.DocumentArray<ITeamStaffMember>;

async function loadTeam(teamId: string) {
  const team = await Team.findById(teamId);
  if (!team) throw notFound("Equipo no encontrado");
  return team;
}

export async function addTeamStaffMember(actor: Actor, teamId: string, input: { name: string; role: TeamStaffRole }) {
  const team = await loadTeam(teamId);
  await requireOrganizerOfChampionship(actor, team.championshipId);

  const staff = staffOf(team);
  staff.push({ name: input.name, role: input.role } as ITeamStaffMember);
  await team.save();

  await recordAudit(actor, {
    action: "update",
    entityType: "team",
    entityId: team._id,
    championshipId: team.championshipId,
    summary: `Cuerpo técnico de ${team.name}: se agregó ${input.name} (${TEAM_STAFF_ROLE_LABEL[input.role]})`,
  });
  return team;
}

export async function updateTeamStaffMember(actor: Actor, teamId: string, staffId: string, input: { name?: string; role?: TeamStaffRole }) {
  const team = await loadTeam(teamId);
  await requireOrganizerOfChampionship(actor, team.championshipId);

  const member = staffOf(team).id(staffId);
  if (!member) throw notFound("Integrante del cuerpo técnico no encontrado");
  member.set(input);
  await team.save();

  await recordAudit(actor, {
    action: "update",
    entityType: "team",
    entityId: team._id,
    championshipId: team.championshipId,
    summary: `Cuerpo técnico de ${team.name}: se actualizó ${member.name}`,
  });
  return team;
}

export async function removeTeamStaffMember(actor: Actor, teamId: string, staffId: string) {
  const team = await loadTeam(teamId);
  await requireOrganizerOfChampionship(actor, team.championshipId);

  const staff = staffOf(team);
  const member = staff.id(staffId);
  if (!member) throw notFound("Integrante del cuerpo técnico no encontrado");
  const name = member.name;
  member.deleteOne();
  await team.save();

  await recordAudit(actor, {
    action: "update",
    entityType: "team",
    entityId: team._id,
    championshipId: team.championshipId,
    summary: `Cuerpo técnico de ${team.name}: se eliminó ${name}`,
  });
  return team;
}

import type { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { badRequest, conflict, notFound } from "@/lib/api";
import { diffChanges, recordAudit } from "@/lib/audit";
import type { PhaseType } from "@/lib/constants";
import { drawGroups, type GroupAssignment } from "@/lib/rules/fixture";
import { computeStandings } from "@/lib/rules/standings";
import { Championship, DEFAULT_RULES } from "@/models/Championship";
import { Match } from "@/models/Match";
import { Matchday } from "@/models/Matchday";
import { IPhase, Phase } from "@/models/Phase";
import { Team } from "@/models/Team";
import { Tie } from "@/models/Tie";

const MIN_TEAMS_PER_GROUP = 2;

async function loadPhase(id: string) {
  const phase = await Phase.findById(id);
  if (!phase) throw notFound("Fase no encontrada");
  return phase;
}

async function assertNoMatches(phaseId: Types.ObjectId, action: string) {
  if (await Match.exists({ phaseId })) {
    throw conflict(`La fase ya tiene partidos; ${action} después de eliminar o reemplazar su calendario`, "phase_has_matches");
  }
}

/** Phases of a championship, in order, with team and match counts. */
export async function listPhases(championshipId: string) {
  const phases = await Phase.find({ championshipId }).sort({ order: 1 }).lean();
  const counts = await Match.aggregate<{ _id: Types.ObjectId; total: number; finished: number }>([
    { $match: { phaseId: { $in: phases.map((phase) => phase._id) } } },
    { $group: { _id: "$phaseId", total: { $sum: 1 }, finished: { $sum: { $cond: [{ $eq: ["$status", "finished"] }, 1, 0] } } } },
  ]);
  const byPhase = new Map(counts.map((row) => [row._id.toString(), row]));
  const tieCounts = await Tie.aggregate<{ _id: Types.ObjectId; total: number; decided: number }>([
    { $match: { phaseId: { $in: phases.map((phase) => phase._id) } } },
    { $group: { _id: "$phaseId", total: { $sum: 1 }, decided: { $sum: { $cond: [{ $ifNull: ["$winnerTeamId", false] }, 1, 0] } } } },
  ]);
  const tiesByPhase = new Map(tieCounts.map((row) => [row._id.toString(), row]));
  const matchdayCounts = await Matchday.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { phaseId: { $in: phases.map((phase) => phase._id) } } },
    { $group: { _id: "$phaseId", total: { $sum: 1 } } },
  ]);
  const matchdaysByPhase = new Map(matchdayCounts.map((row) => [row._id.toString(), row.total]));
  return phases.map((phase) => ({
    ...phase,
    ties: { total: tiesByPhase.get(phase._id.toString())?.total ?? 0, decided: tiesByPhase.get(phase._id.toString())?.decided ?? 0 },
    matchdayCount: matchdaysByPhase.get(phase._id.toString()) ?? 0,
    teamCount: phase.teamIds.length,
    matches: { total: byPhase.get(phase._id.toString())?.total ?? 0, finished: byPhase.get(phase._id.toString())?.finished ?? 0 },
  }));
}

export interface PhaseInput {
  name: string;
  type: PhaseType;
  legs: 1 | 2;
  groupCount?: number;
}

export async function createPhase(actor: Actor, championshipId: string, input: PhaseInput) {
  if (!(await Championship.exists({ _id: championshipId }))) throw notFound("Campeonato no encontrado");
  if (await Phase.exists({ championshipId, name: input.name })) throw conflict("Ya existe una fase con ese nombre", "duplicate");
  if (input.type === "groups" && !input.groupCount) throw badRequest("Indica cuántos grupos tendrá la fase");

  const last = await Phase.findOne({ championshipId }).sort({ order: -1 }).select("order").lean();
  const phase = await Phase.create({
    championshipId,
    name: input.name,
    order: (last?.order ?? 0) + 1,
    type: input.type,
    legs: input.legs,
    groupCount: input.type === "groups" ? input.groupCount : undefined,
  });
  await recordAudit(actor, {
    action: "create",
    entityType: "phase",
    entityId: phase._id,
    championshipId,
    summary: `Fase creada: ${phase.name}`,
  });
  return phase;
}

export async function updatePhase(actor: Actor, id: string, input: Partial<PhaseInput>) {
  const phase = await loadPhase(id);
  const before = phase.toObject() as IPhase;

  if (input.name && input.name !== phase.name && (await Phase.exists({ championshipId: phase.championshipId, name: input.name, _id: { $ne: phase._id } }))) {
    throw conflict("Ya existe una fase con ese nombre", "duplicate");
  }
  const structural = input.type !== undefined || input.legs !== undefined || input.groupCount !== undefined;
  if (structural) await assertNoMatches(phase._id, "cambia su formato");
  if (input.type && input.type !== phase.type && (await Tie.exists({ phaseId: phase._id }))) {
    throw conflict("La fase tiene cruces definidos; elimínalos antes de cambiar su formato", "phase_has_ties");
  }

  const type = input.type ?? phase.type;
  if (type === "groups" && !(input.groupCount ?? phase.groupCount)) throw badRequest("Indica cuántos grupos tendrá la fase");
  if (input.type && input.type !== phase.type) phase.set({ rounds: [] });
  phase.set({
    ...(input.name ? { name: input.name } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.legs ? { legs: input.legs } : {}),
    groupCount: type === "groups" ? input.groupCount ?? phase.groupCount : undefined,
  });
  // A different format invalidates the previous group distribution.
  if (structural) {
    phase.set({ groups: [] });
    await Matchday.deleteMany({ phaseId: phase._id }); // no matches at this point; knockout matchdays depend on the rounds
  }
  await phase.save();

  const changes = diffChanges(before, phase.toObject() as IPhase, ["name", "type", "legs", "groupCount"]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, { action: "update", entityType: "phase", entityId: phase._id, championshipId: phase.championshipId, summary: `Fase actualizada: ${phase.name}`, changes });
  }
  return phase;
}

export async function deletePhase(actor: Actor, id: string) {
  const phase = await loadPhase(id);
  await assertNoMatches(phase._id, "elimínala");
  await Tie.deleteMany({ phaseId: phase._id });
  await Matchday.deleteMany({ phaseId: phase._id });
  await phase.deleteOne();
  await recordAudit(actor, { action: "delete", entityType: "phase", entityId: phase._id, championshipId: phase.championshipId, summary: `Fase eliminada: ${phase.name}` });
}

export interface PhaseTeamsInput {
  teamIds: string[];
  groups?: { name: string; teamIds: string[] }[];
}

/** Sets the participants (and, for group phases, their distribution). The organizer decides both. */
export async function setPhaseTeams(actor: Actor, id: string, input: PhaseTeamsInput) {
  const phase = await loadPhase(id);

  const teamIds = [...new Set(input.teamIds)];
  // Teams can be added at any time (the fixture generator then creates the missing matches); a team that
  // already has matches in the phase cannot leave it, nor change group, or those matches would be orphaned.
  const scheduled = await Match.find({ phaseId: phase._id }).select("homeTeamId awayTeamId").lean();
  const withMatches = new Set(scheduled.flatMap((match) => [match.homeTeamId.toString(), match.awayTeamId.toString()]));
  const leaving = phase.teamIds.map(String).filter((teamId) => withMatches.has(teamId) && !teamIds.includes(teamId));
  if (leaving.length > 0) {
    const names = (await Team.find({ _id: { $in: leaving } }).select("name").lean()).map((team) => team.name).join(", ");
    throw conflict(`No se puede quitar a ${names}: ya tiene partidos en esta fase. Elimina esos partidos primero`, "team_has_matches");
  }
  const valid = await Team.countDocuments({ _id: { $in: teamIds }, championshipId: phase.championshipId });
  if (valid !== teamIds.length) throw badRequest("Algún equipo no pertenece a este campeonato");

  const inTies = await Tie.find({ phaseId: phase._id }).select("homeTeamId awayTeamId").lean();
  const chosen = new Set(teamIds);
  if (inTies.some((tie) => !chosen.has(tie.homeTeamId.toString()) || (tie.awayTeamId && !chosen.has(tie.awayTeamId.toString())))) {
    throw conflict("Algún equipo que quieres quitar está en un cruce; cambia los cruces primero", "team_in_tie");
  }

  let groups: GroupAssignment[] = [];
  if (phase.type === "groups") {
    const requested = input.groups ?? phase.groups.map((group) => ({ name: group.name, teamIds: group.teamIds.map(String) }));
    const inPhase = new Set(teamIds);
    const seen = new Set<string>();
    if (new Set(requested.map((group) => group.name)).size !== requested.length) throw badRequest("Los nombres de los grupos deben ser distintos");
    if (phase.groupCount && requested.length > 0 && requested.length !== phase.groupCount) {
      throw badRequest(`La fase tiene ${phase.groupCount} grupos`);
    }
    groups = requested.map((group) => ({
      name: group.name,
      // Teams removed from the phase also leave their group.
      teamIds: group.teamIds.filter((teamId) => inPhase.has(teamId)),
    }));
    for (const group of groups) {
      for (const teamId of group.teamIds) {
        if (seen.has(teamId)) throw badRequest("Un equipo no puede estar en dos grupos");
        seen.add(teamId);
      }
    }
    const previousGroup = new Map(phase.groups.flatMap((group) => group.teamIds.map((teamId) => [teamId.toString(), group.name] as const)));
    const moved = [...withMatches].filter((teamId) => previousGroup.has(teamId) && groups.find((group) => group.teamIds.includes(teamId))?.name !== previousGroup.get(teamId));
    if (moved.length > 0) {
      const names = (await Team.find({ _id: { $in: moved } }).select("name").lean()).map((team) => team.name).join(", ");
      throw conflict(`No se puede cambiar de grupo a ${names}: ya tiene partidos en esta fase`, "team_has_matches");
    }
  }

  phase.set({ teamIds, groups });
  await phase.save();
  await recordAudit(actor, {
    action: "update",
    entityType: "phase",
    entityId: phase._id,
    championshipId: phase.championshipId,
    summary: `Equipos de la fase ${phase.name}: ${teamIds.length}`,
    changes: { teams: teamIds.length, groups: groups.map((group) => `${group.name}: ${group.teamIds.length}`) },
  });
  return phase;
}

/** Random, even draw of the phase teams into its groups. The result can be adjusted by hand afterwards. */
export async function drawPhaseGroups(actor: Actor, id: string) {
  const phase = await loadPhase(id);
  if (phase.type !== "groups" || !phase.groupCount) throw badRequest("Solo las fases de grupos se sortean");
  await assertNoMatches(phase._id, "sortea de nuevo");
  if (phase.teamIds.length < phase.groupCount * MIN_TEAMS_PER_GROUP) {
    throw badRequest(`Se necesitan al menos ${phase.groupCount * MIN_TEAMS_PER_GROUP} equipos para ${phase.groupCount} grupos`);
  }
  phase.set({ groups: drawGroups(phase.teamIds.map(String), phase.groupCount) });
  await phase.save();
  await recordAudit(actor, { action: "update", entityType: "phase", entityId: phase._id, championshipId: phase.championshipId, summary: `Sorteo de grupos: ${phase.name}` });
  return phase;
}

/** League table of the phase, or one table per group. */
export async function getPhaseStandings(id: string) {
  const phase = await Phase.findById(id).lean();
  if (!phase) throw notFound("Fase no encontrada");
  if (phase.type === "knockout") throw badRequest("Las eliminatorias no tienen tabla; consulta sus llaves");
  const championship = await Championship.findById(phase.championshipId).lean();
  const [teams, matches] = await Promise.all([
    Team.find({ _id: { $in: phase.teamIds } }).select("name shieldUrl").lean(),
    Match.find({ phaseId: phase._id, status: "finished" }).select("homeTeamId awayTeamId homeScore awayScore finishedAt group").lean(),
  ]);
  const team = new Map(teams.map((entry) => [entry._id.toString(), entry]));
  const rules = {
    pointsPerWin: championship?.rules.pointsPerWin ?? DEFAULT_RULES.pointsPerWin,
    pointsPerDraw: championship?.rules.pointsPerDraw ?? DEFAULT_RULES.pointsPerDraw,
    pointsPerLoss: championship?.rules.pointsPerLoss ?? DEFAULT_RULES.pointsPerLoss,
  };
  const toMatch = (match: (typeof matches)[number]) => ({
    homeTeamId: match.homeTeamId.toString(),
    awayTeamId: match.awayTeamId.toString(),
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    finishedAt: match.finishedAt,
  });
  const table = (teamIds: Types.ObjectId[], scope: typeof matches) =>
    computeStandings(
      teamIds.map((teamId) => ({ id: teamId.toString(), name: team.get(teamId.toString())?.name ?? "" })),
      scope.map(toMatch),
      rules
    ).map((row) => ({ ...row, shieldUrl: team.get(row.teamId)?.shieldUrl ?? "" }));

  if (phase.type === "groups") {
    return { phase: { _id: phase._id, name: phase.name, type: phase.type }, tables: phase.groups.map((group) => ({ group: group.name, rows: table(group.teamIds, matches.filter((match) => match.group === group.name)) })) };
  }
  return { phase: { _id: phase._id, name: phase.name, type: phase.type }, tables: [{ group: null, rows: table(phase.teamIds, matches) }] };
}

/**
 * A match that belongs to a phase must be between teams of that phase (and of the same group in a
 * group phase). Returns the group to store.
 */
export async function assertMatchFitsPhase(input: {
  phaseId: string;
  homeTeamId: string;
  awayTeamId: string;
  group?: string | null;
  /** Set when the match belongs to a knockout tie. */
  tieId?: string;
}): Promise<{ group: string | undefined; championshipId: Types.ObjectId }> {
  const phase = await Phase.findById(input.phaseId).lean();
  if (!phase) throw notFound("Fase no encontrada");
  if (phase.type === "knockout" && !input.tieId) throw badRequest("Los partidos de una eliminatoria se crean desde sus cruces");

  const inPhase = new Set(phase.teamIds.map(String));
  if (!inPhase.has(input.homeTeamId) || !inPhase.has(input.awayTeamId)) throw badRequest("Ambos equipos deben participar en la fase");
  if (phase.type !== "groups") return { group: undefined, championshipId: phase.championshipId };

  const group = phase.groups.find((entry) => entry.name === input.group);
  if (!group) throw badRequest("Selecciona el grupo del partido");
  const members = new Set(group.teamIds.map(String));
  if (!members.has(input.homeTeamId) || !members.has(input.awayTeamId)) throw badRequest("Ambos equipos deben ser del mismo grupo");
  return { group: group.name, championshipId: phase.championshipId };
}

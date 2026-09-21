import { notFound } from "@/lib/api";
import { Championship } from "@/models/Championship";
import { Match } from "@/models/Match";
import { Phase } from "@/models/Phase";
import { Player } from "@/models/Player";
import { Team } from "@/models/Team";
import { LIVE_REGISTRATION_STATUSES, TeamRegistration } from "@/models/TeamRegistration";

/** Counters the home screen uses to point the organizer to what is missing or pending. */
export async function getOverview(championshipId: string) {
  if (!(await Championship.exists({ _id: championshipId }))) throw notFound("Campeonato no encontrado");

  const [phases, teams, matches, unscheduledMatches, matchPhaseIds, registrations] = await Promise.all([
    Phase.find({ championshipId }).select("type teamIds").lean(),
    Team.find({ championshipId, active: true }).select("name").sort({ name: 1 }).lean(),
    Match.countDocuments({ championshipId }),
    Match.countDocuments({ championshipId, status: "scheduled", scheduledAt: { $exists: false } }),
    Match.distinct("phaseId", { championshipId }),
    TeamRegistration.distinct("playerId", { championshipId, status: { $in: LIVE_REGISTRATION_STATUSES } }),
  ]);

  const tablePhases = phases.filter((phase) => phase.type !== "knockout");
  const withCalendar = new Set(matchPhaseIds.map(String));
  const inSomePhase = new Set(phases.flatMap((phase) => phase.teamIds.map(String)));
  const playersWithoutFace = await Player.countDocuments({
    _id: { $in: registrations },
    $nor: [{ photoUrl: { $exists: true, $ne: "" }, biometricConsentAt: { $exists: true, $ne: null } }],
  });

  return {
    setup: {
      phases: phases.length,
      tablePhases: tablePhases.length,
      phasesWithTeams: tablePhases.filter((phase) => phase.teamIds.length >= 2).length,
      phasesWithCalendar: tablePhases.filter((phase) => withCalendar.has(phase._id.toString())).length,
      matches,
      scheduledMatches: matches - unscheduledMatches,
    },
    unscheduledMatches,
    // Only meaningful once phases exist: before that every team is "without phase".
    teamsWithoutPhase: phases.length === 0 ? [] : teams.filter((team) => !inSomePhase.has(team._id.toString())).map((team) => ({ _id: team._id.toString(), name: team.name })),
    playersWithoutFace,
  };
}

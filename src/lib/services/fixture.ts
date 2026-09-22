import type { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { badRequest, notFound } from "@/lib/api";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { roundRobin, roundRobinGroups } from "@/lib/rules/fixture";
import { Championship } from "@/models/Championship";
import { ensureMatchday } from "@/lib/services/matchdays";
import { Matchday } from "@/models/Matchday";
import { Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { Phase } from "@/models/Phase";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { Team } from "@/models/Team";

export interface FixtureOptions {
  /** Also delete the scheduled matches without attendance before creating (their days and times are lost). */
  replaceScheduled: boolean;
  /** Only compute the matches; nothing is saved. */
  preview: boolean;
}

const MIN_TEAMS = 2;

/**
 * Generates the matches of a phase following its format (league or groups) for the teams the organizer
 * picked. Every match belongs to a matchday ("Fecha N") of the phase but has NO day, time or venue: the
 * organizer sets them by hand because they change often. Existing matches are kept and their home/away
 * pairing is not generated again (the rest is built around them: the missing pairings go to fechas where
 * both teams are still free), so running it twice only adds what is missing; replacing the
 * scheduled matches without attendance is an explicit option.
 */
export async function generateFixture(actor: Actor, phaseId: string, options: FixtureOptions) {
  const phase = await Phase.findById(phaseId).lean();
  if (!phase) throw notFound("Fase no encontrada");
  const championshipId = phase.championshipId;
  const championship = await Championship.findById(championshipId).lean();
  if (!championship) throw notFound("Campeonato no encontrado");
  await requireOrganizerOfChampionship(actor, championshipId);

  if (phase.type === "knockout") throw badRequest("Las eliminatorias se programan por ronda desde sus llaves");

  const teams = await Team.find({ championshipId, active: true, _id: { $in: phase.teamIds } })
    .select("name")
    .sort({ name: 1 })
    .lean();
  if (teams.length < MIN_TEAMS) {
    throw badRequest("Selecciona al menos 2 equipos activos en la fase antes de generar el calendario");
  }
  const teamName = new Map(teams.map((team) => [team._id.toString(), team.name]));
  const activeTeams = new Set(teamName.keys());

  const legs = phase.legs;
  let baseRounds;
  if (phase.type === "groups") {
    const groups = phase.groups.map((group) => ({ name: group.name, teamIds: group.teamIds.map(String).filter((id) => activeTeams.has(id)) }));
    const grouped = new Set(groups.flatMap((group) => group.teamIds));
    if (groups.length === 0 || [...activeTeams].some((id) => !grouped.has(id))) {
      throw badRequest("Todos los equipos de la fase deben estar en un grupo; sortea o asigna los grupos primero");
    }
    if (groups.some((group) => group.teamIds.length < 2)) throw badRequest("Cada grupo necesita al menos 2 equipos");
    baseRounds = roundRobinGroups(groups, legs);
  } else {
    baseRounds = roundRobin([...activeTeams], legs);
  }

  const existing = await Match.find({ phaseId: phase._id }).select("homeTeamId awayTeamId status matchdayId").lean();
  const scheduled = existing.filter((match) => match.status === "scheduled");
  const withAttendance = new Set(
    (await PlayerCheckIn.distinct("matchId", { matchId: { $in: scheduled.map((match) => match._id) }, status: { $ne: "pending" } })).map(String)
  );
  const replaceable = scheduled.filter((match) => !withAttendance.has(match._id.toString()));
  const replaceableIds = new Set(replaceable.map((match) => match._id.toString()));

  const willReplace = options.replaceScheduled;
  const kept = existing.filter((match) => !(willReplace && replaceableIds.has(match._id.toString())));
  // With a single leg the venue does not matter: a match already created in either direction covers the pairing.
  const pairingKey = (home: string, away: string) => (legs === 1 && home > away ? `${away}>${home}` : `${home}>${away}`);
  const keptPairings = new Set(kept.map((match) => pairingKey(String(match.homeTeamId), String(match.awayTeamId))));

  // Matchdays already in the phase and which teams already play in each one (from the kept matches).
  const matchdays = await Matchday.find({ phaseId: phase._id }).select("number").lean();
  const numberById = new Map(matchdays.map((item) => [item._id.toString(), item.number]));
  const busy = new Map<number, Set<string>>();
  for (const number of numberById.values()) busy.set(number, new Set());
  for (const match of kept) {
    const number = numberById.get(String(match.matchdayId));
    if (number === undefined) continue;
    busy.get(number)?.add(String(match.homeTeamId)).add(String(match.awayTeamId));
  }
  let lastNumber = Math.max(0, ...busy.keys());

  // Each missing pairing goes to its natural round when both teams are free there; otherwise to the first
  // matchday where both are free (existing matchdays first) or to a new one at the end.
  const placed: { round: number; group?: string; homeTeamId: string; awayTeamId: string }[] = [];
  for (const entry of baseRounds) {
    entry.pairings.forEach(([home, away], index) => {
      if (keptPairings.has(pairingKey(home, away))) return;
      const isFree = (number: number) => !busy.get(number)?.has(home) && !busy.get(number)?.has(away);
      let target = busy.has(entry.round) && isFree(entry.round) ? entry.round : undefined;
      target ??= [...busy.keys()].sort((x, y) => x - y).find(isFree);
      if (target === undefined) {
        target = entry.round > lastNumber ? entry.round : lastNumber + 1;
        busy.set(target, new Set());
      }
      lastNumber = Math.max(lastNumber, target);
      busy.get(target)?.add(home).add(away);
      placed.push({ round: target, group: entry.groupNames?.[index], homeTeamId: home, awayTeamId: away });
    });
  }
  placed.sort((x, y) => x.round - y.round);
  const matches = placed;
  const rounds = [...new Set(matches.map((match) => match.round))].map((round) => ({ round }));
  if (matches.length === 0) {
    // Nothing to add: the preview explains it (and offers to replace); creating is refused.
    if (options.preview) return { matches: [], byes: [], rounds: 0, replaceable: replaceable.length, kept: kept.length, created: 0 };
    throw badRequest("No hay partidos nuevos por generar: los cruces de esta fase ya existen");
  }

  // Rests are only meaningful when the calendar is generated from scratch.
  const byeByRound = new Map(kept.length > 0 ? [] : baseRounds.map((entry) => [entry.round, entry.byes.map((id) => teamName.get(id) ?? "")] as const));
  const preview = {
    matches: matches.map((match) => ({
      round: match.round,
      group: match.group,
      homeTeam: { _id: match.homeTeamId, name: teamName.get(match.homeTeamId) ?? "" },
      awayTeam: { _id: match.awayTeamId, name: teamName.get(match.awayTeamId) ?? "" },
    })),
    byes: [...byeByRound].filter(([, names]) => names.length > 0).map(([round, names]) => ({ round, teams: names })),
    rounds: rounds.length,
    /** Scheduled matches without attendance that already exist and would be replaced. */
    replaceable: replaceable.length,
    kept: kept.length,
  };
  if (options.preview) return { ...preview, created: 0 };

  if (willReplace && replaceable.length > 0) {
    const ids = replaceable.map((match) => match._id);
    await PlayerCheckIn.deleteMany({ matchId: { $in: ids } });
    await MatchCallUp.deleteMany({ matchId: { $in: ids } });
    await Match.deleteMany({ _id: { $in: ids } });
  }

  // Squads are called up lazily the first time attendance is opened, so creating many matches stays fast.
  // Each round of the calendar is a matchday ("Fecha N") of the phase; existing ones are reused by number.
  const matchdayByNumber = new Map<number, Types.ObjectId>();
  for (const number of new Set(matches.map((match) => match.round))) {
    matchdayByNumber.set(number, (await ensureMatchday(phase, number))._id);
  }
  await Match.insertMany(
    matches.map((match) => ({
      championshipId,
      phaseId: phase._id,
      matchdayId: matchdayByNumber.get(match.round),
      group: match.group,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
    }))
  );

  await recordAudit(actor, {
    action: "update",
    entityType: "championship",
    entityId: championship._id,
    championshipId: championship._id,
    summary: `Partidos generados (${phase.name}): ${matches.length} en ${rounds.length} fechas, sin día ni hora`,
    changes: { phaseId, legs, matches: matches.length, rounds: rounds.length, replaced: options.replaceScheduled ? replaceable.length : 0 },
  });
  return { ...preview, created: matches.length };
}

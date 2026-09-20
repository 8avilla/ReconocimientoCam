import { computeStandings } from "@/lib/rules/standings";
import { notFound } from "@/lib/api";
import { Championship, DEFAULT_RULES } from "@/models/Championship";
import { Match } from "@/models/Match";
import { MatchEvent } from "@/models/MatchEvent";
import { Team } from "@/models/Team";

/** League table from the finished matches of a championship. */
export async function getStandings(championshipId: string) {
  const championship = await Championship.findById(championshipId).lean();
  if (!championship) throw notFound("Campeonato no encontrado");

  const [teams, matches] = await Promise.all([
    Team.find({ championshipId }).select("name shieldUrl active").lean(),
    Match.find({ championshipId, status: "finished" }).select("homeTeamId awayTeamId homeScore awayScore finishedAt").lean(),
  ]);
  const table = computeStandings(
    teams.map((team) => ({ id: team._id.toString(), name: team.name })),
    matches.map((match) => ({
      homeTeamId: match.homeTeamId.toString(),
      awayTeamId: match.awayTeamId.toString(),
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      finishedAt: match.finishedAt,
    })),
    {
      pointsPerWin: championship.rules.pointsPerWin ?? DEFAULT_RULES.pointsPerWin,
      pointsPerDraw: championship.rules.pointsPerDraw ?? DEFAULT_RULES.pointsPerDraw,
      pointsPerLoss: championship.rules.pointsPerLoss ?? DEFAULT_RULES.pointsPerLoss,
    }
  );
  const shieldByTeam = new Map(teams.map((team) => [team._id.toString(), team.shieldUrl]));
  return table.map((row) => ({ ...row, shieldUrl: shieldByTeam.get(row.teamId) ?? "" }));
}

interface PlayerTally {
  playerId: string;
  fullName: string;
  photoUrl: string;
  teamId: string;
  teamName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
}

/** Player statistics from the non-voided events of the finished matches. */
export async function getPlayerStats(championshipId: string) {
  if (!(await Championship.exists({ _id: championshipId }))) throw notFound("Campeonato no encontrado");

  const matchIds = (await Match.find({ championshipId, status: "finished" }).select("_id").lean()).map((match) => match._id);
  const [events, teams] = await Promise.all([
    MatchEvent.find({ matchId: { $in: matchIds }, voided: false, type: { $in: ["goal", "penalty_goal", "own_goal", "yellow_card", "red_card"] } })
      .populate({ path: "playerId", select: "fullName photoUrl" })
      .populate({ path: "relatedPlayerId", select: "fullName photoUrl" })
      .lean(),
    Team.find({ championshipId }).select("name").lean(),
  ]);
  const teamName = new Map(teams.map((team) => [team._id.toString(), team.name]));

  const tallies = new Map<string, PlayerTally>();
  const tally = (player: { _id: { toString(): string }; fullName: string; photoUrl: string } | null | undefined, teamId: string) => {
    if (!player) return null;
    const key = player._id.toString();
    if (!tallies.has(key)) {
      tallies.set(key, {
        playerId: key, fullName: player.fullName, photoUrl: player.photoUrl, teamId, teamName: teamName.get(teamId) ?? "",
        goals: 0, assists: 0, yellowCards: 0, redCards: 0, ownGoals: 0,
      });
    }
    return tallies.get(key)!;
  };

  for (const event of events) {
    const teamId = event.teamId.toString();
    const player = event.playerId as unknown as Parameters<typeof tally>[0];
    const related = event.relatedPlayerId as unknown as Parameters<typeof tally>[0];
    if (event.type === "goal" || event.type === "penalty_goal") {
      const scorer = tally(player, teamId);
      if (scorer) scorer.goals += 1;
      const assistant = tally(related, teamId);
      if (assistant) assistant.assists += 1;
    } else if (event.type === "own_goal") {
      const scorer = tally(player, teamId);
      if (scorer) scorer.ownGoals += 1;
    } else if (event.type === "yellow_card") {
      const carded = tally(player, teamId);
      if (carded) carded.yellowCards += 1;
    } else if (event.type === "red_card") {
      const carded = tally(player, teamId);
      if (carded) carded.redCards += 1;
    }
  }

  const all = [...tallies.values()];
  const byName = (a: PlayerTally, b: PlayerTally) => a.fullName.localeCompare(b.fullName, "es");
  return {
    matchesPlayed: matchIds.length,
    scorers: all.filter((row) => row.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists || byName(a, b)),
    assisters: all.filter((row) => row.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals || byName(a, b)),
    cards: all
      .filter((row) => row.yellowCards + row.redCards > 0)
      .sort((a, b) => b.redCards - a.redCards || b.yellowCards - a.yellowCards || byName(a, b)),
  };
}

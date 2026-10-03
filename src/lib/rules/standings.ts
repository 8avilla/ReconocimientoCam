import type { TiebreakCriterion } from "@/lib/constants";

export interface StandingsTeam {
  id: string;
  name: string;
}

/** A finished match with a score. */
export interface FinishedMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  /** Used to order the recent-form list; older first. */
  finishedAt?: Date | string;
  /** Set for a walkover: the result comes from here, not from comparing scores (the goals are optional). */
  winnerTeamId?: string;
}

export interface PointsRules {
  pointsPerWin: number;
  pointsPerDraw: number;
  pointsPerLoss: number;
}

export type FormResult = "W" | "D" | "L";

export interface StandingsRow {
  position: number;
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Fair play points (fewer is better); only present when the table was computed with them. */
  fairPlay?: number;
  /** Last results, most recent last. */
  form: FormResult[];
}

const FORM_LENGTH = 5;

/** Historical default, kept for any phase that hasn't picked its own order (see `Phase.tiebreakers`). */
const DEFAULT_TIEBREAKERS: TiebreakCriterion[] = ["goal_difference", "goals_for"];

type Row = Omit<StandingsRow, "position">;

/** Points earned by `teamId` against `opponentId` alone, and the goal difference in those matches only —
 * a pairwise reading of "enfrentamiento directo", not the full round-robin mini-table some federations use
 * for 3-way ties. Good enough for the common two-team-tied case this app mostly sees. */
function headToHeadScore(teamId: string, opponentId: string, matches: readonly FinishedMatch[], rules: PointsRules): number {
  let points = 0;
  let goalDiff = 0;
  for (const match of matches) {
    const isTeamHome = match.homeTeamId === teamId && match.awayTeamId === opponentId;
    const isTeamAway = match.awayTeamId === teamId && match.homeTeamId === opponentId;
    if (!isTeamHome && !isTeamAway) continue;
    const scored = isTeamHome ? match.homeScore : match.awayScore;
    const conceded = isTeamHome ? match.awayScore : match.homeScore;
    goalDiff += scored - conceded;
    if (match.winnerTeamId) points += match.winnerTeamId === teamId ? rules.pointsPerWin : rules.pointsPerLoss;
    else points += scored > conceded ? rules.pointsPerWin : scored < conceded ? rules.pointsPerLoss : rules.pointsPerDraw;
  }
  return points * 1000 + goalDiff; // points decide first; goal difference only breaks a head-to-head points tie.
}

function compareByCriterion(criterion: TiebreakCriterion, a: Row, b: Row, matches: readonly FinishedMatch[], rules: PointsRules): number {
  switch (criterion) {
    case "goal_difference": return b.goalDifference - a.goalDifference;
    case "goals_for": return b.goalsFor - a.goalsFor;
    case "fewest_goals_against": return a.goalsAgainst - b.goalsAgainst;
    case "most_wins": return b.won - a.won;
    case "fair_play": return (a.fairPlay ?? 0) - (b.fairPlay ?? 0);
    case "head_to_head": return headToHeadScore(b.teamId, a.teamId, matches, rules) - headToHeadScore(a.teamId, b.teamId, matches, rules);
  }
}

/**
 * League table. Order: points, then the given tiebreak criteria in that order, then team name.
 * `tiebreakers` is the list of criteria in use (any subset, in the order chosen; an empty list means only points,
 * then name) and defaults to the historical order (goal difference, then goals for) when omitted, so existing
 * phases that never set their own keep behaving exactly as before.
 * `fairPlayPoints` (team id -> points, fewer is better) is needed for the "fair_play" criterion; teams missing from it have 0.
 */
export function computeStandings(
  teams: readonly StandingsTeam[],
  matches: readonly FinishedMatch[],
  rules: PointsRules,
  tiebreakers: readonly TiebreakCriterion[] = DEFAULT_TIEBREAKERS,
  fairPlayPoints?: ReadonlyMap<string, number>
): StandingsRow[] {
  const rows = new Map<string, Omit<StandingsRow, "position" | "goalDifference">>(
    teams.map((team) => [
      team.id,
      { teamId: team.id, name: team.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] },
    ])
  );

  const chronological = [...matches].sort(
    (a, b) => new Date(a.finishedAt ?? 0).getTime() - new Date(b.finishedAt ?? 0).getTime()
  );
  for (const match of chronological) {
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) continue;

    // A walkover's result comes from the recorded winner, not from the score (its goals are optional).
    const homeResult: FormResult = match.winnerTeamId
      ? (match.winnerTeamId === match.homeTeamId ? "W" : "L")
      : match.homeScore > match.awayScore
        ? "W"
        : match.homeScore < match.awayScore
          ? "L"
          : "D";
    const awayResult: FormResult = homeResult === "W" ? "L" : homeResult === "L" ? "W" : "D";

    const apply = (row: typeof home, scored: number, conceded: number, result: FormResult) => {
      row.played += 1;
      row.goalsFor += scored;
      row.goalsAgainst += conceded;
      if (result === "W") { row.won += 1; row.points += rules.pointsPerWin; }
      else if (result === "D") { row.drawn += 1; row.points += rules.pointsPerDraw; }
      else { row.lost += 1; row.points += rules.pointsPerLoss; }
      row.form = [...row.form, result].slice(-FORM_LENGTH);
    };
    apply(home, match.homeScore, match.awayScore, homeResult);
    apply(away, match.awayScore, match.homeScore, awayResult);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
      ...(fairPlayPoints ? { fairPlay: fairPlayPoints.get(row.teamId) ?? 0 } : {}),
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      for (const criterion of tiebreakers) {
        const result = compareByCriterion(criterion, a, b, matches, rules);
        if (result !== 0) return result;
      }
      return a.name.localeCompare(b.name, "es");
    })
    .map((row, index) => ({ position: index + 1, ...row }));
}

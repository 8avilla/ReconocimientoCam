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
  /** Last results, most recent last. */
  form: FormResult[];
}

const FORM_LENGTH = 5;

/**
 * League table. Order: points, goal difference, goals for, then team name.
 * Head-to-head is not applied as a tiebreaker.
 */
export function computeStandings(teams: readonly StandingsTeam[], matches: readonly FinishedMatch[], rules: PointsRules): StandingsRow[] {
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

    const apply = (row: typeof home, scored: number, conceded: number) => {
      row.played += 1;
      row.goalsFor += scored;
      row.goalsAgainst += conceded;
      const result: FormResult = scored > conceded ? "W" : scored < conceded ? "L" : "D";
      if (result === "W") { row.won += 1; row.points += rules.pointsPerWin; }
      else if (result === "D") { row.drawn += 1; row.points += rules.pointsPerDraw; }
      else { row.lost += 1; row.points += rules.pointsPerLoss; }
      row.form = [...row.form, result].slice(-FORM_LENGTH);
    };
    apply(home, match.homeScore, match.awayScore);
    apply(away, match.awayScore, match.homeScore);
  }

  return [...rows.values()]
    .map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, "es"))
    .map((row, index) => ({ position: index + 1, ...row }));
}

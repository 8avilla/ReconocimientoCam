/** Pure helpers for knockout rounds. Everything here only *proposes*; the organizer decides. */

/** A pairing of two teams; `null` as the second team means the first one advances without playing (bye). */
export type TiePair = [string, string | null];

export interface TieMatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
}

/** Goals of each tie team across its finished matches. */
export function aggregateScore(matches: readonly TieMatchResult[], teamA: string, teamB: string) {
  let goalsA = 0;
  let goalsB = 0;
  let played = 0;
  for (const match of matches) {
    if (match.status !== "finished") continue;
    played += 1;
    const home = match.homeScore ?? 0;
    const away = match.awayScore ?? 0;
    if (match.homeTeamId === teamA) {
      goalsA += home;
      goalsB += away;
    } else if (match.homeTeamId === teamB) {
      goalsB += home;
      goalsA += away;
    }
  }
  return { teamA: goalsA, teamB: goalsB, played };
}

/**
 * Suggests the team that advances when every leg is finished and the aggregate is not level.
 * Level ties return null: the organizer decides (no penalties are recorded).
 */
export function suggestWinner(matches: readonly TieMatchResult[], expectedLegs: number, teamA: string, teamB: string): string | null {
  const aggregate = aggregateScore(matches, teamA, teamB);
  if (aggregate.played < expectedLegs || aggregate.teamA === aggregate.teamB) return null;
  return aggregate.teamA > aggregate.teamB ? teamA : teamB;
}

/** Best seed against worst: 1 vs N, 2 vs N-1... With an odd count the best seed gets the bye. */
export function seedPairs(orderedTeamIds: readonly string[]): TiePair[] {
  const teams = [...orderedTeamIds];
  const pairs: TiePair[] = [];
  if (teams.length % 2 === 1) pairs.push([teams.shift()!, null]);
  for (let index = 0; index < teams.length / 2; index++) pairs.push([teams[index], teams[teams.length - 1 - index]]);
  return pairs;
}

/** Random pairing; with an odd count one random team gets the bye. `random` is injectable for tests. */
export function randomPairs(teamIds: readonly string[], random: () => number = Math.random): TiePair[] {
  const shuffled = [...teamIds];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const pairs: TiePair[] = [];
  for (let index = 0; index < shuffled.length; index += 2) pairs.push([shuffled[index], shuffled[index + 1] ?? null]);
  return pairs;
}

/** Pairs consecutive teams: 1st with 2nd, 3rd with 4th... (e.g. winners of tie 1 and tie 2 meet). */
export function sequentialPairs(teamIds: readonly string[]): TiePair[] {
  const pairs: TiePair[] = [];
  for (let index = 0; index < teamIds.length; index += 2) pairs.push([teamIds[index], teamIds[index + 1] ?? null]);
  return pairs;
}

/** A conventional name for a round with `tieCount` ties ("Final", "Semifinal"...). */
export function suggestedRoundName(tieCount: number): string {
  const names: Record<number, string> = { 1: "Final", 2: "Semifinal", 4: "Cuartos de final", 8: "Octavos de final", 16: "Dieciseisavos de final" };
  return names[tieCount] ?? `Ronda de ${tieCount * 2}`;
}

export interface RankedRow {
  teamId: string;
  position: number;
  points: number;
  goalDifference: number;
  goalsFor: number;
}

/**
 * Orders the teams of one or several tables (e.g. the groups of a previous phase) to use them as seeds:
 * every 1st place first (best record first), then every 2nd place, and so on.
 */
export function orderFromTables(tables: readonly (readonly RankedRow[])[]): string[] {
  return tables
    .flat()
    .sort((a, b) => a.position - b.position || b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
    .map((row) => row.teamId);
}

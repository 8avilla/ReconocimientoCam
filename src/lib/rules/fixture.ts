/** A pairing inside a round: [home, away] team ids. */
export type Pairing = [string, string];

export interface FixtureRound {
  round: number;
  pairings: Pairing[];
  /** Group of each pairing (same index), for group phases. */
  groupNames?: string[];
  /** Teams without a match in this round (only when the number of teams is odd). */
  byes: string[];
}

/**
 * Round-robin with the circle method: every team plays every other team once per leg and once per round.
 * Home/away is assigned greedily so each team's home and away games stay balanced (the second leg
 * repeats every pairing with the venues swapped).
 */
export function roundRobin(teamIds: readonly string[], legs: 1 | 2 = 1): FixtureRound[] {
  const teams: (string | null)[] = [...teamIds];
  if (teams.length % 2 === 1) teams.push(null); // null = rest day
  const size = teams.length;

  const balance = new Map(teamIds.map((id) => [id, 0])); // home games minus away games
  const lastVenue = new Map<string, "H" | "A">();
  const firstLeg: FixtureRound[] = [];

  for (let round = 0; round < size - 1; round++) {
    const pairings: Pairing[] = [];
    const byes: string[] = [];
    for (let index = 0; index < size / 2; index++) {
      const a = teams[index];
      const b = teams[size - 1 - index];
      if (a === null || b === null) {
        byes.push((a ?? b) as string);
        continue;
      }
      let aIsHome: boolean;
      if (balance.get(a) !== balance.get(b)) aIsHome = balance.get(a)! < balance.get(b)!;
      else if (lastVenue.get(a) !== lastVenue.get(b)) aIsHome = lastVenue.get(a) === "A";
      else aIsHome = round % 2 === 0;

      const [home, away] = aIsHome ? [a, b] : [b, a];
      balance.set(home, balance.get(home)! + 1);
      balance.set(away, balance.get(away)! - 1);
      lastVenue.set(home, "H");
      lastVenue.set(away, "A");
      pairings.push([home, away]);
    }
    firstLeg.push({ round: round + 1, pairings, byes });
    teams.splice(1, 0, teams.pop()!); // rotate everyone but the first team
  }

  if (legs === 1) return firstLeg;
  const secondLeg = firstLeg.map((entry, index) => ({
    round: firstLeg.length + index + 1,
    pairings: entry.pairings.map(([home, away]): Pairing => [away, home]),
    byes: entry.byes,
  }));
  return [...firstLeg, ...secondLeg];
}

export interface GroupAssignment {
  name: string;
  teamIds: string[];
}

/** "Grupo A", "Grupo B"... */
export const groupLabel = (index: number) => `Grupo ${String.fromCharCode(65 + index)}`;

/**
 * Splits the teams into `groupCount` groups of even size (they differ by at most one team),
 * shuffling first so the draw is random. `random` is injectable for tests.
 */
export function drawGroups(teamIds: readonly string[], groupCount: number, random: () => number = Math.random): GroupAssignment[] {
  const shuffled = [...teamIds];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const groups: GroupAssignment[] = Array.from({ length: groupCount }, (_, index) => ({ name: groupLabel(index), teamIds: [] }));
  shuffled.forEach((teamId, index) => groups[index % groupCount].teamIds.push(teamId));
  return groups;
}

/**
 * Round-robin inside every group. Round N of all groups is played in the same matchday, so the
 * groups advance in parallel; groups with fewer teams simply have fewer rounds.
 */
export function roundRobinGroups(groups: readonly GroupAssignment[], legs: 1 | 2 = 1): FixtureRound[] {
  const perGroup = groups.map((group) => ({ name: group.name, rounds: roundRobin(group.teamIds, legs) }));
  const roundCount = Math.max(0, ...perGroup.map((group) => group.rounds.length));
  return Array.from({ length: roundCount }, (_, index) => {
    const pairings: Pairing[] = [];
    const groupNames: string[] = [];
    const byes: string[] = [];
    for (const group of perGroup) {
      const entry = group.rounds[index];
      if (!entry) continue;
      for (const pairing of entry.pairings) {
        pairings.push(pairing);
        groupNames.push(group.name);
      }
      byes.push(...entry.byes);
    }
    return { round: index + 1, pairings, groupNames, byes };
  });
}

import { describe, expect, it } from "vitest";
import { drawGroups, groupLabel, roundRobin, roundRobinGroups } from "./fixture";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `t${index + 1}`);
const key = (a: string, b: string) => [a, b].sort().join("|");

describe("roundRobin", () => {
  it.each([3, 4, 5, 6, 8, 10])("con %i equipos cada pareja juega una vez y nadie repite en una jornada", (count) => {
    const rounds = roundRobin(ids(count), 1);
    const seen = new Set<string>();
    for (const round of rounds) {
      const inRound = new Set<string>();
      for (const [home, away] of round.pairings) {
        const pair = key(home, away);
        expect(seen.has(pair)).toBe(false);
        seen.add(pair);
        expect(inRound.has(home) || inRound.has(away)).toBe(false);
        inRound.add(home);
        inRound.add(away);
      }
    }
    expect(seen.size).toBe((count * (count - 1)) / 2);
  });

  it("con número impar de equipos uno descansa cada jornada", () => {
    const rounds = roundRobin(ids(5), 1);
    expect(rounds).toHaveLength(5);
    expect(rounds.every((round) => round.byes.length === 1 && round.pairings.length === 2)).toBe(true);
    // Every team rests exactly once.
    expect(new Set(rounds.flatMap((round) => round.byes)).size).toBe(5);
  });

  it("ida y vuelta duplica las jornadas e invierte la localía", () => {
    const rounds = roundRobin(ids(4), 2);
    expect(rounds).toHaveLength(6);
    expect(rounds.map((round) => round.round)).toEqual([1, 2, 3, 4, 5, 6]);
    const firstLeg = rounds.slice(0, 3).flatMap((round) => round.pairings.map(([home, away]) => `${home}>${away}`));
    const secondLeg = rounds.slice(3).flatMap((round) => round.pairings.map(([home, away]) => `${away}>${home}`));
    expect(secondLeg).toEqual(firstLeg);
  });

  it("equilibra locales y visitantes", () => {
    for (const count of [4, 6, 8, 10, 12]) {
      const balance = new Map<string, number>();
      for (const round of roundRobin(ids(count), 1)) {
        for (const [home, away] of round.pairings) {
          balance.set(home, (balance.get(home) ?? 0) + 1);
          balance.set(away, (balance.get(away) ?? 0) - 1);
        }
      }
      expect(Math.max(...[...balance.values()].map(Math.abs))).toBeLessThanOrEqual(3);
    }
  });
});

describe("drawGroups", () => {
  it("reparte los equipos de forma pareja sin repetir ni perder ninguno", () => {
    const groups = drawGroups(ids(10), 3);
    expect(groups.map((group) => group.name)).toEqual(["Grupo A", "Grupo B", "Grupo C"]);
    const sizes = groups.map((group) => group.teamIds.length).sort();
    expect(sizes).toEqual([3, 3, 4]);
    expect(groups.flatMap((group) => group.teamIds).sort()).toEqual(ids(10).sort());
  });

  it("es aleatorio pero reproducible con un generador dado", () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const first = drawGroups(ids(8), 2, random);
    seed = 1;
    expect(drawGroups(ids(8), 2, random)).toEqual(first);
    expect(first[0].teamIds).not.toEqual(ids(8).slice(0, 4)); // shuffled, not in the given order
  });

  it("nombra los grupos con letras", () => {
    expect(groupLabel(0)).toBe("Grupo A");
    expect(groupLabel(3)).toBe("Grupo D");
  });
});

describe("roundRobinGroups", () => {
  const groups = [
    { name: "Grupo A", teamIds: ["a1", "a2", "a3", "a4"] },
    { name: "Grupo B", teamIds: ["b1", "b2", "b3", "b4"] },
  ];

  it("juega todos contra todos dentro de cada grupo y nunca cruza grupos", () => {
    const rounds = roundRobinGroups(groups, 1);
    expect(rounds).toHaveLength(3);
    for (const round of rounds) {
      expect(round.pairings).toHaveLength(4); // 2 per group
      round.pairings.forEach(([home, away], index) => {
        expect(home[0]).toBe(away[0]); // same group letter
        expect(round.groupNames![index]).toBe(`Grupo ${home[0].toUpperCase()}`);
      });
    }
    expect(rounds.flatMap((round) => round.pairings)).toHaveLength(12);
  });

  it("con ida y vuelta duplica las jornadas", () => {
    expect(roundRobinGroups(groups, 2)).toHaveLength(6);
  });

  it("los grupos de distinto tamaño terminan en jornadas distintas", () => {
    const uneven = [
      { name: "Grupo A", teamIds: ["a1", "a2", "a3", "a4"] },
      { name: "Grupo B", teamIds: ["b1", "b2", "b3"] },
    ];
    const rounds = roundRobinGroups(uneven, 1);
    expect(rounds).toHaveLength(3);
    expect(rounds[0].byes).toHaveLength(1); // the 3-team group rests one team
  });
});

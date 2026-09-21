import { describe, expect, it } from "vitest";
import { aggregateScore, orderFromTables, randomPairs, seedPairs, sequentialPairs, suggestedRoundName, suggestWinner } from "./knockout";

const match = (homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number, status = "finished") => ({ homeTeamId, awayTeamId, homeScore, awayScore, status });

describe("aggregateScore", () => {
  it("suma los goles de cada equipo en ida y vuelta, sin importar la localía", () => {
    const result = aggregateScore([match("a", "b", 2, 0), match("b", "a", 1, 1)], "a", "b");
    expect(result).toEqual({ teamA: 3, teamB: 1, played: 2 });
  });

  it("ignora los partidos que no han finalizado", () => {
    expect(aggregateScore([match("a", "b", 2, 0), match("b", "a", 5, 0, "live")], "a", "b")).toEqual({ teamA: 2, teamB: 0, played: 1 });
  });
});

describe("suggestWinner", () => {
  it("sugiere al ganador del partido único", () => {
    expect(suggestWinner([match("a", "b", 1, 0)], 1, "a", "b")).toBe("a");
    expect(suggestWinner([match("a", "b", 0, 3)], 1, "a", "b")).toBe("b");
  });

  it("espera a que se jueguen todos los partidos", () => {
    expect(suggestWinner([match("a", "b", 2, 0)], 2, "a", "b")).toBeNull();
  });

  it("no sugiere nada si el global está empatado: decide el organizador", () => {
    expect(suggestWinner([match("a", "b", 1, 0), match("b", "a", 1, 0)], 2, "a", "b")).toBeNull();
  });

  it("define por el global en ida y vuelta", () => {
    expect(suggestWinner([match("a", "b", 0, 1), match("b", "a", 0, 3)], 2, "a", "b")).toBe("a");
  });
});

describe("propuestas de cruces", () => {
  const ids = (count: number) => Array.from({ length: count }, (_, index) => `t${index + 1}`);

  it("seedPairs enfrenta al mejor contra el peor", () => {
    expect(seedPairs(ids(8))).toEqual([["t1", "t8"], ["t2", "t7"], ["t3", "t6"], ["t4", "t5"]]);
  });

  it("seedPairs da descanso al mejor sembrado si el número es impar", () => {
    expect(seedPairs(ids(5))).toEqual([["t1", null], ["t2", "t5"], ["t3", "t4"]]);
  });

  it("randomPairs usa a todos los equipos exactamente una vez", () => {
    const pairs = randomPairs(ids(7));
    const used = pairs.flat().filter(Boolean) as string[];
    expect(new Set(used).size).toBe(7);
    expect(pairs.filter(([, away]) => away === null)).toHaveLength(1);
  });

  it("sequentialPairs empareja de dos en dos", () => {
    expect(sequentialPairs(ids(4))).toEqual([["t1", "t2"], ["t3", "t4"]]);
    expect(sequentialPairs(ids(3))).toEqual([["t1", "t2"], ["t3", null]]);
  });

  it("nombra las rondas de forma convencional", () => {
    expect(suggestedRoundName(1)).toBe("Final");
    expect(suggestedRoundName(2)).toBe("Semifinal");
    expect(suggestedRoundName(4)).toBe("Cuartos de final");
    expect(suggestedRoundName(8)).toBe("Octavos de final");
    expect(suggestedRoundName(3)).toBe("Ronda de 6");
  });
});

describe("orderFromTables", () => {
  const row = (teamId: string, position: number, points: number, goalDifference = 0, goalsFor = 0) => ({ teamId, position, points, goalDifference, goalsFor });

  it("pone primero a todos los primeros de grupo, luego a los segundos", () => {
    const groupA = [row("a1", 1, 9), row("a2", 2, 4)];
    const groupB = [row("b1", 1, 7), row("b2", 2, 6)];
    expect(orderFromTables([groupA, groupB])).toEqual(["a1", "b1", "b2", "a2"]);
  });

  it("desempata por diferencia de gol y goles a favor", () => {
    const table = [row("x", 1, 6, 2, 5), row("y", 1, 6, 4, 3), row("z", 1, 6, 4, 6)];
    expect(orderFromTables([table])).toEqual(["z", "y", "x"]);
  });
});

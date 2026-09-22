import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";

const RULES = { pointsPerWin: 3, pointsPerDraw: 1, pointsPerLoss: 0 };
const teams = [
  { id: "a", name: "Atlas" },
  { id: "b", name: "Brazuca" },
  { id: "c", name: "Condor" },
];

describe("computeStandings", () => {
  it("suma puntos, goles y resultados por equipo", () => {
    const table = computeStandings(
      teams,
      [
        { homeTeamId: "a", awayTeamId: "b", homeScore: 2, awayScore: 0 },
        { homeTeamId: "b", awayTeamId: "c", homeScore: 1, awayScore: 1 },
      ],
      RULES
    );
    const atlas = table.find((row) => row.teamId === "a")!;
    expect(atlas).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 2, goalsAgainst: 0, goalDifference: 2, position: 1 });
    expect(table.find((row) => row.teamId === "b")).toMatchObject({ played: 2, drawn: 1, lost: 1, points: 1 });
    expect(table.find((row) => row.teamId === "c")).toMatchObject({ played: 1, drawn: 1, points: 1 });
  });

  it("respeta los puntos configurados en el campeonato", () => {
    const table = computeStandings(teams, [{ homeTeamId: "a", awayTeamId: "b", homeScore: 1, awayScore: 0 }], { pointsPerWin: 2, pointsPerDraw: 1, pointsPerLoss: 0 });
    expect(table[0].points).toBe(2);
  });

  it("desempata por diferencia de gol, luego goles a favor y por último nombre", () => {
    const table = computeStandings(
      teams,
      [
        { homeTeamId: "a", awayTeamId: "c", homeScore: 1, awayScore: 0 }, // a: 3 pts, +1
        { homeTeamId: "b", awayTeamId: "c", homeScore: 3, awayScore: 1 }, // b: 3 pts, +2 -> above a
      ],
      RULES
    );
    expect(table.map((row) => row.teamId)).toEqual(["b", "a", "c"]);
  });

  it("incluye equipos sin partidos jugados con cero", () => {
    const table = computeStandings(teams, [], RULES);
    expect(table).toHaveLength(3);
    expect(table.every((row) => row.played === 0 && row.points === 0)).toBe(true);
    expect(table.map((row) => row.name)).toEqual(["Atlas", "Brazuca", "Condor"]);
  });

  it("guarda los últimos 5 resultados en orden cronológico", () => {
    const matches = Array.from({ length: 6 }, (_, index) => ({
      homeTeamId: "a", awayTeamId: "b", homeScore: index === 0 ? 0 : 1, awayScore: index === 0 ? 1 : 0, finishedAt: new Date(2025, 0, index + 1),
    }));
    const atlas = computeStandings(teams, matches, RULES).find((row) => row.teamId === "a")!;
    expect(atlas.form).toEqual(["W", "W", "W", "W", "W"]); // the first-day loss fell out of the window
  });

  it("ignora partidos de equipos que no pertenecen a la lista", () => {
    const table = computeStandings(teams, [{ homeTeamId: "x", awayTeamId: "a", homeScore: 5, awayScore: 0 }], RULES);
    expect(table.find((row) => row.teamId === "a")!.played).toBe(0);
  });

  it("un W.O. sin goles configurados registra la victoria por el ganador, no por el marcador", () => {
    const table = computeStandings(
      teams,
      [{ homeTeamId: "a", awayTeamId: "b", homeScore: 0, awayScore: 0, winnerTeamId: "a" }],
      RULES
    );
    expect(table.find((row) => row.teamId === "a")).toMatchObject({ won: 1, points: 3, form: ["W"] });
    expect(table.find((row) => row.teamId === "b")).toMatchObject({ lost: 1, points: 0, form: ["L"] });
  });

  it("un W.O. con goles configurados también suma la diferencia de gol", () => {
    const table = computeStandings(
      teams,
      [{ homeTeamId: "b", awayTeamId: "a", homeScore: 0, awayScore: 3, winnerTeamId: "a" }],
      RULES
    );
    expect(table.find((row) => row.teamId === "a")).toMatchObject({ won: 1, goalsFor: 3, goalDifference: 3 });
  });
});

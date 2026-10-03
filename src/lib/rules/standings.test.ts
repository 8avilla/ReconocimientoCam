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

  it("respeta los puntos configurados en el torneo", () => {
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

  describe("criterios activables y juego limpio", () => {
    // Atlas y Brazuca empatan en todo (1-1): solo el criterio elegido los separa.
    const draw = [{ homeTeamId: "a", awayTeamId: "b", homeScore: 1, awayScore: 1 }];
    const order = (table: ReturnType<typeof computeStandings>) => table.filter((row) => row.teamId !== "c").map((row) => row.teamId);

    it("juego limpio: queda arriba el equipo con menos puntos por tarjetas", () => {
      const points = new Map([["a", 5], ["b", 2]]);
      expect(order(computeStandings(teams, draw, RULES, ["fair_play"], points))).toEqual(["b", "a"]);
      // Sin tarjetas registradas para uno de ellos cuenta 0
      expect(order(computeStandings(teams, draw, RULES, ["fair_play"], new Map([["a", 1]])))).toEqual(["b", "a"]);
    });

    it("la tabla trae los puntos de juego limpio de cada equipo, y no los trae si no se calcularon", () => {
      const withPoints = computeStandings(teams, draw, RULES, ["fair_play"], new Map([["a", 3]]));
      expect(withPoints.find((row) => row.teamId === "a")!.fairPlay).toBe(3);
      expect(withPoints.find((row) => row.teamId === "b")!.fairPlay).toBe(0);
      expect(computeStandings(teams, draw, RULES, ["goal_difference"]).every((row) => row.fairPlay === undefined)).toBe(true);
    });

    it("el orden de los criterios activos lo decide quien configura la fase", () => {
      // Atlas gana en juego limpio pero tiene peor diferencia de gol
      const matches = [
        { homeTeamId: "a", awayTeamId: "c", homeScore: 1, awayScore: 0 },
        { homeTeamId: "b", awayTeamId: "c", homeScore: 4, awayScore: 0 },
      ];
      const points = new Map([["a", 0], ["b", 6]]);
      expect(order(computeStandings(teams, matches, RULES, ["fair_play", "goal_difference"], points))).toEqual(["a", "b"]);
      expect(order(computeStandings(teams, matches, RULES, ["goal_difference", "fair_play"], points))).toEqual(["b", "a"]);
    });

    it("un criterio desactivado no cuenta: con la lista vacía solo importan los puntos y luego el nombre", () => {
      const matches = [
        { homeTeamId: "a", awayTeamId: "c", homeScore: 1, awayScore: 0 },
        { homeTeamId: "b", awayTeamId: "c", homeScore: 4, awayScore: 0 },
      ];
      // Brazuca tiene mucha mejor diferencia de gol, pero ese criterio está desactivado
      expect(order(computeStandings(teams, matches, RULES, []))).toEqual(["a", "b"]);
    });

    it("sin lista propia se mantiene el orden histórico (diferencia de gol, luego goles a favor)", () => {
      const matches = [
        { homeTeamId: "a", awayTeamId: "c", homeScore: 1, awayScore: 0 },
        { homeTeamId: "b", awayTeamId: "c", homeScore: 4, awayScore: 0 },
      ];
      expect(order(computeStandings(teams, matches, RULES))).toEqual(["b", "a"]);
    });
  });
});

import { describe, expect, it } from "vitest";
import { attendanceReport, calendarReport, rankingReport, standingsReport } from "./reports";
import type { AttendanceRowDTO, MatchDTO, PlayerStatDTO } from "@/types/api";

const home = { _id: "h", name: "Leones", shieldUrl: "" };
const away = { _id: "a", name: "Halcones", shieldUrl: "" };
const row = (id: string, teamId: string, shirt: number, extra: Partial<AttendanceRowDTO> = {}): AttendanceRowDTO => ({
  _id: `c${id}`, teamId, status: "pending", shirtNumber: shirt, position: null, registrationStatus: "active",
  playerId: { _id: id, publicId: id, fullName: `Jugador ${id}`, photoUrl: "" }, ...extra,
});

describe("attendanceReport", () => {
  it("lists home squad first, by shirt number, with readable labels", () => {
    const report = attendanceReport({ homeTeamId: home, awayTeamId: away }, [
      row("3", "a", 1),
      row("2", "h", 10, { status: "present", method: "face", operatorName: "Ana", verificationId: { result: "verified", method: "face", performedAt: "2026-10-03T12:00:00Z" } }),
      row("1", "h", 4, { status: "absent" }),
    ]);
    expect(report.rows.map((r) => [r[0], r[1]])).toEqual([["Leones", 4], ["Leones", 10], ["Halcones", 1]]);
    expect(report.rows[1]).toMatchObject({ 3: "Presente", 4: "Reconocimiento facial", 6: "Verificado", 7: "Ana" });
    expect(report.rows[0][3]).toBe("Ausente");
    expect(report.rows[0][6]).toBe("Sin verificar");
    expect(report.rows.every((r) => r.length === report.headers.length)).toBe(true);
  });
});

describe("standingsReport / rankingReport", () => {
  it("keeps one row per team with the table columns", () => {
    const leones = { position: 1, teamId: "h", name: "Leones", shieldUrl: "", played: 4, won: 4, drawn: 0, lost: 0, goalsFor: 21, goalsAgainst: 4, goalDifference: 17, points: 12, form: [] as [] };
    expect(standingsReport([{ group: null, rows: [leones] }]).rows).toEqual([[1, "Leones", 4, 4, 0, 0, 21, 4, 17, 12]]);
    const grouped = standingsReport([{ group: "Grupo A", rows: [leones] }]);
    expect(grouped.headers[0]).toBe("Grupo");
    expect(grouped.rows[0][0]).toBe("Grupo A");
  });

  it("numbers the ranking and uses the chosen stat", () => {
    const player = (name: string, goals: number): PlayerStatDTO => ({ playerId: name, fullName: name, photoUrl: "", teamId: "h", teamName: "Leones", goals, assists: 0, yellowCards: 0, redCards: 0, ownGoals: 0 });
    expect(rankingReport([player("Ana", 5), player("Luis", 3)], "Goles", (r) => r.goals).rows).toEqual([[1, "Ana", "Leones", 5], [2, "Luis", "Leones", 3]]);
  });
});

describe("calendarReport", () => {
  const match = (status: MatchDTO["status"], extra: Partial<MatchDTO> = {}): MatchDTO => ({
    _id: "m", championshipId: "c", homeTeamId: home, awayTeamId: away, scheduledAt: "", venue: "Cancha 1",
    matchdayId: { _id: "d", number: 2, name: "Fecha 2" }, status, phaseId: { _id: "p", name: "Todos contra Todos", type: "league" }, period: "not_started", ...extra,
  });

  it("shows the score only once the match started", () => {
    const report = calendarReport([match("scheduled"), match("finished", { homeScore: 3, awayScore: 1 })]);
    expect(report.rows[0][8]).toBe("");
    expect(report.rows[1][8]).toBe("3 - 1");
    expect(report.rows[1].slice(0, 4)).toEqual(["Todos contra Todos", "Fecha 2", "Leones", "Halcones"]);
  });
});

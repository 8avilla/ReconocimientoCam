import { describe, expect, it } from "vitest";
import { applyMatchAction, computeScore, reachesYellowThreshold, suggestedMinute } from "./match";

const HOME = "home";
const AWAY = "away";

describe("computeScore", () => {
  it("cuenta goles y penales para el equipo que anota", () => {
    const score = computeScore(
      [
        { type: "goal", teamId: HOME, voided: false },
        { type: "penalty_goal", teamId: AWAY, voided: false },
        { type: "goal", teamId: HOME, voided: false },
      ],
      HOME,
      AWAY
    );
    expect(score).toEqual({ home: 2, away: 1 });
  });

  it("acredita el autogol al rival", () => {
    expect(computeScore([{ type: "own_goal", teamId: HOME, voided: false }], HOME, AWAY)).toEqual({ home: 0, away: 1 });
  });

  it("ignora eventos anulados, penales fallados y tarjetas", () => {
    const score = computeScore(
      [
        { type: "goal", teamId: HOME, voided: true },
        { type: "penalty_missed", teamId: HOME, voided: false },
        { type: "yellow_card", teamId: AWAY, voided: false },
      ],
      HOME,
      AWAY
    );
    expect(score).toEqual({ home: 0, away: 0 });
  });
});

describe("applyMatchAction", () => {
  it("recorre el ciclo completo del partido", () => {
    let phase = { status: "scheduled", period: "not_started" } as const as Parameters<typeof applyMatchAction>[1];
    for (const [action, period] of [["start", "first_half"], ["halftime", "half_time"], ["resume", "second_half"], ["finish", "finished"]] as const) {
      const next = applyMatchAction(action, phase);
      expect(next?.period).toBe(period);
      phase = next!;
    }
    expect(phase.status).toBe("finished");
  });

  it("rechaza acciones fuera de secuencia", () => {
    expect(applyMatchAction("halftime", { status: "scheduled", period: "not_started" })).toBeNull();
    expect(applyMatchAction("resume", { status: "live", period: "first_half" })).toBeNull();
    expect(applyMatchAction("start", { status: "live", period: "first_half" })).toBeNull();
    expect(applyMatchAction("finish", { status: "finished", period: "finished" })).toBeNull();
  });

  it("permite finalizar desde el medio tiempo", () => {
    expect(applyMatchAction("finish", { status: "live", period: "half_time" })?.status).toBe("finished");
  });
});

describe("reachesYellowThreshold", () => {
  it("se activa al llegar al umbral", () => {
    expect(reachesYellowThreshold(2, 3)).toBe(false);
    expect(reachesYellowThreshold(3, 3)).toBe(true);
  });
});

describe("suggestedMinute", () => {
  const start = new Date("2025-09-20T19:00:00Z");
  it("cuenta desde 0 en el primer tiempo", () => {
    expect(suggestedMinute("first_half", start, new Date("2025-09-20T19:12:30Z"))).toBe(12);
  });
  it("cuenta desde 45 en el segundo tiempo", () => {
    expect(suggestedMinute("second_half", start, new Date("2025-09-20T19:10:00Z"))).toBe(55);
  });
  it("usa 45 en el medio tiempo", () => {
    expect(suggestedMinute("half_time", start)).toBe(45);
  });
});

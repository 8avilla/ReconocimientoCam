import { describe, expect, it } from "vitest";
import { currentPhase } from "./currentPhase";

const phase = (order: number, total: number, finished: number) => ({ order, matches: { total, finished } });

describe("currentPhase", () => {
  it("is the first phase with matches left to play", () => {
    const phases = [phase(1, 6, 6), phase(2, 4, 1), phase(3, 2, 0)];
    expect(currentPhase(phases)).toBe(phases[1]);
  });
  it("skips phases without a calendar yet", () => {
    const phases = [phase(1, 0, 0), phase(2, 3, 1)];
    expect(currentPhase(phases)).toBe(phases[1]);
  });
  it("is the last played phase when everything is finished", () => {
    const phases = [phase(1, 6, 6), phase(2, 2, 2), phase(3, 0, 0)];
    expect(currentPhase(phases)).toBe(phases[1]);
  });
  it("falls back to the first phase before any calendar", () => {
    const phases = [phase(2, 0, 0), phase(1, 0, 0)];
    expect(currentPhase(phases)).toBe(phases[1]);
  });
  it("handles no phases", () => {
    expect(currentPhase([])).toBeUndefined();
  });
});

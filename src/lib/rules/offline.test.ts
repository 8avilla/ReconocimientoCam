import { describe, expect, it } from "vitest";
import { isStale, resolveOccurredAt } from "./offline";

const NOW = new Date("2026-10-03T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("resolveOccurredAt", () => {
  it("uses now when the device sent nothing", () => {
    expect(resolveOccurredAt(undefined, NOW)).toEqual({ at: NOW, offline: false });
  });

  it("keeps the device's time for a change queued minutes ago", () => {
    const result = resolveOccurredAt(ago(10 * 60 * 1000), NOW);
    expect(result.at).toEqual(ago(10 * 60 * 1000));
    expect(result.offline).toBe(true);
  });

  it("treats a just-sent request as online", () => {
    expect(resolveOccurredAt(ago(300), NOW).offline).toBe(false);
  });

  it("falls back to now for a time too old or too far in the future", () => {
    expect(resolveOccurredAt(ago(8 * 24 * 60 * 60 * 1000), NOW)).toEqual({ at: NOW, offline: false });
    expect(resolveOccurredAt(new Date(NOW.getTime() + 60 * 60 * 1000), NOW)).toEqual({ at: NOW, offline: false });
  });

  it("clamps a small clock skew to now", () => {
    expect(resolveOccurredAt(new Date(NOW.getTime() + 60 * 1000), NOW).at).toEqual(NOW);
  });

  it("ignores an invalid date", () => {
    expect(resolveOccurredAt(new Date("nope"), NOW)).toEqual({ at: NOW, offline: false });
  });
});

describe("isStale", () => {
  it("only an offline change can lose to a newer record", () => {
    expect(isStale(ago(1000), ago(5000), true)).toBe(true);
    expect(isStale(ago(5000), ago(1000), true)).toBe(false);
    expect(isStale(ago(1000), ago(5000), false)).toBe(false);
  });

  it("a player nobody has marked yet is never stale", () => {
    expect(isStale(undefined, ago(5000), true)).toBe(false);
  });

  it("the same change replayed after a lost response is not stale", () => {
    expect(isStale(ago(5000), ago(5000), true)).toBe(false);
  });
});

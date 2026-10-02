import { describe, expect, it } from "vitest";
import { messages, resolveAudience, type FollowRef } from "./notifications";

const f = (userId: string, targetType: FollowRef["targetType"], targetId: string): FollowRef => ({ userId, targetType, targetId });
const subjects = { championshipId: "c1", teamIds: ["t1", "t2"], playerIds: ["p1"] };
const follows = [f("ana", "championship", "c1"), f("beto", "team", "t1"), f("carla", "player", "p1"), f("dani", "team", "t9"), f("eva", "championship", "c9")];

describe("resolveAudience", () => {
  it("a schedule or result reaches followers of the championship and of either team, not of a player", () => {
    expect(resolveAudience("match_finished", subjects, [...follows, f("fabio", "player", "p1")]).sort()).toEqual(["ana", "beto"]);
  });

  it("a goal reaches team and player followers, but not the whole championship", () => {
    expect(resolveAudience("goal", subjects, follows).sort()).toEqual(["beto", "carla"]);
  });

  it("ignores follows of things not involved in the event", () => {
    expect(resolveAudience("goal", subjects, [f("dani", "team", "t9"), f("eva", "player", "p9")])).toEqual([]);
  });

  it("notifies each person once even when several follows match", () => {
    expect(resolveAudience("goal", subjects, [f("beto", "team", "t1"), f("beto", "team", "t2"), f("beto", "player", "p1")])).toEqual(["beto"]);
  });

  it("never notifies the person who caused the event", () => {
    expect(resolveAudience("match_started", subjects, follows, "ana")).toEqual(["beto"]);
  });

  it("a team-only event carries no player: player followers hear nothing", () => {
    expect(resolveAudience("match_scheduled", { ...subjects, playerIds: [] }, [f("carla", "player", "p1")])).toEqual([]);
  });
});

describe("messages", () => {
  const match = { homeName: "Leones", awayName: "Halcones", homeScore: 2, awayScore: 1 };

  it("tells the score with both teams", () => {
    expect(messages.finished(match)).toEqual({ title: "Final del partido", body: "Leones 2 - 1 Halcones" });
    expect(messages.goal(match, "Hugo Mendoza", 23, false)).toEqual({ title: "¡Gol de Hugo Mendoza! (23')", body: "Leones 2 - 1 Halcones" });
  });

  it("distinguishes own goals and card colours", () => {
    expect(messages.goal(match, "Ana", 5, true).title).toBe("Autogol de Ana (5')");
    expect(messages.card(match, "Luis", 70, true).title).toBe("Tarjeta roja a Luis (70')");
    expect(messages.card(match, "Luis", 70, false).title).toBe("Tarjeta amarilla a Luis (70')");
  });

  it("schedules say rescheduled when the match already had a date", () => {
    const at = new Date("2026-10-10T15:00:00Z");
    expect(messages.scheduled(match, at, false).title).toBe("Partido programado");
    expect(messages.scheduled(match, at, true).title).toBe("Partido reprogramado");
    expect(messages.scheduled(match, at, false).body).toContain("Leones vs Halcones");
  });

  it("suspension pluralises", () => {
    expect(messages.suspension("Ana", 1).body).toBe("No jugará el próximo partido.");
    expect(messages.suspension("Ana", 3).body).toBe("No jugará los próximos 3 partidos.");
  });
});

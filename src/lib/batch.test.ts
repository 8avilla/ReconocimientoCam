import { describe, expect, it } from "vitest";
import { expandTemplates, findBatchable, followUps, parseBatchPath } from "./batch";

describe("parseBatchPath", () => {
  it("accepts plain app addresses, with or without a query", () => {
    expect(parseBatchPath("/matches/abc/events")).toEqual({ pathname: "/matches/abc/events", full: "/matches/abc/events" });
    expect(parseBatchPath("/matches?championshipId=1&limit=5")).toMatchObject({ pathname: "/matches" });
  });

  it("refuses anything that is not a local address", () => {
    for (const bad of ["matches", "//evil.test/x", "/a/../b", "/a#frag", "https://evil.test", `/${"x".repeat(700)}`]) expect(parseBatchPath(bad)).toBeNull();
  });
});

describe("findBatchable", () => {
  it("finds the handler and its parameters", () => {
    expect(findBatchable("/matches/m1/attendance")?.params).toEqual({ id: "m1" });
    expect(findBatchable("/phases/p9/standings")?.params).toEqual({ id: "p9" });
    expect(findBatchable("/matches")?.params).toEqual({});
  });

  it("only what is listed can be called", () => {
    for (const closed of ["/users", "/users/me", "/auth/session", "/matches/m1/check-ins", "/championships/c1/organizers", "/follows", "/audit-logs"]) expect(findBatchable(closed)).toBeNull();
  });
});

describe("expandTemplates", () => {
  it("fills in the championship the screen is about", () => {
    expect(expandTemplates(["/championships/:route", "/championships/:cid/phases"], { id: "c1", route: "ligaestrella" })).toEqual(["/championships/ligaestrella", "/championships/c1/phases"]);
    expect(expandTemplates(["/championships/:cid"], null)).toEqual(["/championships/:cid"]);
  });
});

describe("followUps", () => {
  it("a match brings its championship, phases, standings and the home team's results", () => {
    const body = { championshipId: "c1", phaseId: { _id: "p1", type: "league" }, homeTeamId: { _id: "t1" } };
    expect(followUps("/matches/m1", body)).toEqual([
      "/championships/c1",
      "/championships/c1/phases",
      "/phases/p1/standings",
      "/matches?championshipId=c1&teamId=t1&played=true&order=date&limit=50",
    ]);
  });

  it("a knockout phase has no standings", () => {
    expect(followUps("/matches/m1", { championshipId: "c1", phaseId: { _id: "p1", type: "knockout" }, homeTeamId: { _id: "t1" } })).not.toContain("/phases/p1/standings");
  });

  it("the phase list brings the standings of the current phase", () => {
    const phases = [
      { _id: "p1", order: 1, type: "league", matches: { total: 6, finished: 6 } },
      { _id: "p2", order: 2, type: "league", matches: { total: 6, finished: 2 } },
    ];
    expect(followUps("/championships/c1/phases", { data: phases })).toEqual(["/phases/p2/standings"]);
  });

  it("nothing else asks for more", () => {
    expect(followUps("/matches", { data: [] })).toEqual([]);
    expect(followUps("/matches/m1", null)).toEqual([]);
    expect(followUps("/matches/m1", {})).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_TIEBREAKERS, inactiveTiebreakers, resolveTiebreakers } from "./tiebreakers";

describe("resolveTiebreakers", () => {
  it("a phase never configured uses the historical default", () => {
    expect(resolveTiebreakers({})).toEqual([...DEFAULT_TIEBREAKERS]);
    // what creation used to store: an empty list that nobody chose
    expect(resolveTiebreakers({ tiebreakers: [] })).toEqual([...DEFAULT_TIEBREAKERS]);
  });

  it("a saved list is used as it is, in its order", () => {
    expect(resolveTiebreakers({ tiebreakers: ["fair_play", "head_to_head"], tiebreakersCustom: true })).toEqual(["fair_play", "head_to_head"]);
    // saved before the flag existed
    expect(resolveTiebreakers({ tiebreakers: ["goals_for", "head_to_head"] })).toEqual(["goals_for", "head_to_head"]);
  });

  it("choosing none is possible and kept: only points count", () => {
    expect(resolveTiebreakers({ tiebreakers: [], tiebreakersCustom: true })).toEqual([]);
  });
});

describe("inactiveTiebreakers", () => {
  it("lists what the system offers and is not in use", () => {
    expect(inactiveTiebreakers(["goal_difference", "goals_for"])).toEqual(["head_to_head", "fewest_goals_against", "most_wins", "fair_play"]);
    expect(inactiveTiebreakers([])).toHaveLength(6);
  });
});

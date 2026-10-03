import { describe, expect, it } from "vitest";
import { fairPlayPoints, type CardEvent } from "./fairPlay";

const yellow = (id: string, teamId: string): CardEvent => ({ _id: id, teamId, type: "yellow_card" });
const red = (id: string, teamId: string, linkedEventId?: string): CardEvent => ({ _id: id, teamId, type: "red_card", linkedEventId });

describe("fairPlayPoints", () => {
  it("a yellow adds the yellow weight and a red the red weight", () => {
    const points = fairPlayPoints([yellow("1", "A"), yellow("2", "A"), red("3", "A"), yellow("4", "B")], { yellow: 1, red: 2 });
    expect(points.get("A")).toBe(4);
    expect(points.get("B")).toBe(1);
  });

  it("a double yellow weighs one yellow plus one red", () => {
    // yellow, second yellow, automatic red linked to the second one
    const points = fairPlayPoints([yellow("y1", "A"), yellow("y2", "A"), red("r", "A", "y2")], { yellow: 1, red: 2 });
    expect(points.get("A")).toBe(3);
  });

  it("uses whatever weights the championship set", () => {
    expect(fairPlayPoints([yellow("1", "A"), red("2", "A")], { yellow: 2, red: 5 }).get("A")).toBe(7);
    expect(fairPlayPoints([yellow("1", "A")], { yellow: 0, red: 0 }).get("A")).toBe(0);
  });

  it("a team with no cards is absent", () => {
    expect(fairPlayPoints([], { yellow: 1, red: 2 }).size).toBe(0);
  });
});

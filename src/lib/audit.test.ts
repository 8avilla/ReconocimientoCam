import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { diffChanges } from "./audit";

describe("diffChanges", () => {
  it("solo reporta los campos que cambian", () => {
    const before = { name: "Atlas", active: true, delegate: "Carlos" };
    const changes = diffChanges(before, { name: "Atlas FC", active: true }, ["name", "active", "delegate"]);
    expect(changes).toEqual({ name: { from: "Atlas", to: "Atlas FC" } });
  });

  it("compara fechas e ids por valor", () => {
    const id = new Types.ObjectId();
    const before = { at: new Date("2025-01-01T00:00:00Z"), ref: id };
    const same = diffChanges(before, { at: new Date("2025-01-01T00:00:00Z"), ref: new Types.ObjectId(id.toString()) }, ["at", "ref"]);
    expect(same).toEqual({});
  });

  it("ignora claves ausentes en el cambio", () => {
    expect(diffChanges({ a: 1, b: 2 }, { a: 1 }, ["a", "b"])).toEqual({});
  });
});

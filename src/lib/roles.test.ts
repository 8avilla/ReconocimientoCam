import { describe, expect, it } from "vitest";
import { can, canAccess } from "./roles";

describe("role permissions", () => {
  it("the visitor only reads", () => {
    for (const permission of ["championship.manage", "match.manage", "match.operate", "team.manage", "roster.manage", "player.manage", "sanction.manage", "app.manage"] as const) {
      expect(can("visitor", permission)).toBe(false);
    }
  });
  it("the organizer has the visitor's view plus the organizing tools, but not the app's", () => {
    expect(can("organizer", "match.manage")).toBe(true);
    expect(can("organizer", "match.operate")).toBe(true);
    expect(can("organizer", "sanction.manage")).toBe(true);
    expect(can("organizer", "championship.delete")).toBe(false);
    expect(can("organizer", "app.manage")).toBe(false);
  });
  it("the admin can do everything", () => {
    expect(can("admin", "app.manage")).toBe(true);
    expect(can("admin", "championship.delete")).toBe(true);
    expect(can("admin", "match.manage")).toBe(true);
  });
});

describe("screen access", () => {
  it("limits the visitor to reading screens", () => {
    expect(canAccess("visitor", "/")).toBe(true);
    expect(canAccess("visitor", "/championships")).toBe(true);
    expect(canAccess("visitor", "/championships/abc")).toBe(false);
    expect(canAccess("visitor", "/matches/123")).toBe(true);
    expect(canAccess("visitor", "/teams/abc")).toBe(true);
    expect(canAccess("visitor", "/players")).toBe(false);
    expect(canAccess("visitor", "/players/new")).toBe(false);
  });
  it("lets the organizer open everything except the administration", () => {
    expect(canAccess("organizer", "/championships/abc")).toBe(true);
    expect(canAccess("organizer", "/players/new")).toBe(true);
    expect(canAccess("organizer", "/admin")).toBe(false);
  });
  it("lets the admin open everything", () => {
    expect(canAccess("admin", "/admin")).toBe(true);
    expect(canAccess("admin", "/championships/abc")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { routePattern } from "./usage";

describe("routePattern", () => {
  it("replaces the championship id of scoped pages", () => {
    expect(routePattern("/c/6650a1b2c3d4e5f6a7b8c9d0/partidos")).toBe("/c/:id/partidos");
    expect(routePattern("/c/mi-liga")).toBe("/c/:id");
    expect(routePattern("/c/mi-liga/jugadores/nuevo")).toBe("/c/:id/jugadores/nuevo");
  });

  it("replaces the id of detail pages but keeps fixed pages", () => {
    expect(routePattern("/matches/6650a1b2c3d4e5f6a7b8c9d0")).toBe("/matches/:id");
    expect(routePattern("/teams/abc")).toBe("/teams/:id");
    expect(routePattern("/admin")).toBe("/admin");
    expect(routePattern("/")).toBe("/");
  });
});

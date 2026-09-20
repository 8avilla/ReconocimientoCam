import { describe, expect, it } from "vitest";
import {
  checkInCreateSchema,
  championshipCreateSchema,
  matchCreateSchema,
  playerCreateSchema,
} from "./schemas";

const id = "64b7f0f2a1b2c3d4e5f60718";
const otherId = "64b7f0f2a1b2c3d4e5f60719";

describe("matchCreateSchema", () => {
  const base = { championshipId: id, homeTeamId: id, awayTeamId: otherId, scheduledAt: "2025-09-20T19:00:00Z" };

  it("acepta equipos distintos", () => {
    expect(matchCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza el mismo equipo como local y visitante", () => {
    expect(matchCreateSchema.safeParse({ ...base, awayTeamId: id }).success).toBe(false);
  });
});

describe("playerCreateSchema", () => {
  it("rechaza fechas de nacimiento futuras", () => {
    const result = playerCreateSchema.safeParse({ fullName: "Ana", documentId: "1", birthDate: "2999-01-01" });
    expect(result.success).toBe(false);
  });

  it("rechaza nombre vacío", () => {
    expect(playerCreateSchema.safeParse({ fullName: "  ", documentId: "1", birthDate: "2000-01-01" }).success).toBe(false);
  });
});

describe("checkInCreateSchema", () => {
  it("permite el registro manual con o sin motivo", () => {
    expect(checkInCreateSchema.safeParse({ playerId: id, status: "present", method: "manual" }).success).toBe(true);
    expect(checkInCreateSchema.safeParse({ playerId: id, status: "present", method: "manual", reason: "QR dañado" }).success).toBe(true);
  });

  it("no permite el método facial de forma directa", () => {
    expect(checkInCreateSchema.safeParse({ playerId: id, status: "present", method: "face" }).success).toBe(false);
  });
});

describe("championshipCreateSchema", () => {
  it("rechaza fecha de fin anterior al inicio", () => {
    const result = championshipCreateSchema.safeParse({
      name: "Liga",
      season: "2025",
      startDate: "2025-10-01",
      endDate: "2025-09-01",
    });
    expect(result.success).toBe(false);
  });
});

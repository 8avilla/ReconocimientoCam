import { describe, expect, it } from "vitest";
import { classifySimilarity } from "./verification";

const thresholds = { verifyThreshold: 0.35, reviewThreshold: 0.25 };

describe("classifySimilarity", () => {
  it("verifica cuando la similitud alcanza el umbral", () => {
    expect(classifySimilarity(0.35, thresholds)).toBe("verified");
    expect(classifySimilarity(0.9, thresholds)).toBe("verified");
  });

  it("envía a revisión en la banda intermedia", () => {
    expect(classifySimilarity(0.3, thresholds)).toBe("review");
    expect(classifySimilarity(0.25, thresholds)).toBe("review");
  });

  it("marca no coincide por debajo del umbral de revisión", () => {
    expect(classifySimilarity(0.24, thresholds)).toBe("mismatch");
    expect(classifySimilarity(-0.1, thresholds)).toBe("mismatch");
  });
});

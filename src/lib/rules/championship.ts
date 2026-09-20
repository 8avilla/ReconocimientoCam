import { badRequest } from "@/lib/api";
import type { ChampionshipRules } from "@/models/Championship";

/** The manual-review band must sit below the automatic verification threshold. */
export function assertThresholdOrder(rules: Pick<ChampionshipRules, "verifyThreshold" | "reviewThreshold">): void {
  if (rules.reviewThreshold > rules.verifyThreshold) {
    throw badRequest("El umbral de revisión no puede superar el umbral de verificación");
  }
}

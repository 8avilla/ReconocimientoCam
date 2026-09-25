import type { Actor } from "@/lib/actor";
import { badRequest } from "@/lib/api";
import { diffChanges, recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";
import { SystemSettings, type ISystemSettings } from "@/models/SystemSettings";

type Thresholds = Pick<ISystemSettings, "verifyThreshold" | "reviewThreshold">;

/** The one settings document, created with its schema defaults the first time it's needed. */
async function getOrCreateDoc() {
  const existing = await SystemSettings.findOne();
  return existing ?? (await SystemSettings.create({}));
}

/** App-wide face-verification thresholds, the same for every championship. */
export async function getSystemSettings(): Promise<Thresholds> {
  const doc = await getOrCreateDoc();
  return { verifyThreshold: doc.verifyThreshold, reviewThreshold: doc.reviewThreshold };
}

/** The manual-review band must sit below the automatic verification threshold. */
export async function updateSystemSettings(actor: Actor, input: Thresholds): Promise<Thresholds> {
  requireAdmin(actor);
  if (input.reviewThreshold > input.verifyThreshold) {
    throw badRequest("El umbral de revisión no puede superar el umbral de verificación");
  }
  const doc = await getOrCreateDoc();
  const before: Thresholds = { verifyThreshold: doc.verifyThreshold, reviewThreshold: doc.reviewThreshold };
  doc.set(input);
  await doc.save();

  const changes = diffChanges(before, input, ["verifyThreshold", "reviewThreshold"]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action: "update",
      entityType: "system_settings",
      entityId: doc._id,
      summary: "Configuración del sistema actualizada",
      changes,
    });
  }
  return { verifyThreshold: doc.verifyThreshold, reviewThreshold: doc.reviewThreshold };
}

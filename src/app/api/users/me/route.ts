import { ApiError, json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { recordAudit } from "@/lib/audit";
import { accountDeletionImpact, deleteOwnAccount } from "@/lib/services/users";
import { accountDeleteSchema } from "@/lib/validation/schemas";

function requireUserId(userId: string | null): string {
  if (!userId) throw new ApiError(401, "Inicia sesión para hacer esto", "unauthenticated");
  return userId;
}

/** What deleting the signed-in account would affect. */
export const GET = route(async (request) => {
  const userId = requireUserId(getActor(request).userId);
  return json(await accountDeletionImpact(userId));
});

/** The signed-in person deletes their own account. The client signs out afterwards. */
export const DELETE = route(async (request) => {
  const actor = getActor(request);
  const userId = requireUserId(actor.userId);
  await parseBody(request, accountDeleteSchema);
  await deleteOwnAccount(userId);
  await recordAudit(actor, { action: "delete", entityType: "user", entityId: userId, summary: "Cuenta eliminada por su titular" });
  return json({ ok: true });
});

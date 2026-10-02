import { Types } from "mongoose";
import type { Permission } from "@/lib/roles";
import { ALL_PERMISSIONS } from "@/lib/roles";
import { conflict } from "@/lib/api";
import { deleteDemo } from "@/lib/services/demo";
import { Championship } from "@/models/Championship";
import { Follow } from "@/models/Follow";
import { Notification } from "@/models/Notification";
import { PushSubscription } from "@/models/PushSubscription";
import { IdentityVerification } from "@/models/IdentityVerification";
import { Player } from "@/models/Player";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { UsageEvent } from "@/models/UsageEvent";
import { Role } from "@/models/Role";
import { User } from "@/models/User";

/** Fields safe to send to the client — never `passwordHash` or the reset-token fields. */
export const PUBLIC_USER_FIELDS = "name email image isAdmin roleId createdAt";

/** Reloads a user by id with only the public fields, for API responses after a create/update. */
export async function loadPublicUser(id: Types.ObjectId | string) {
  return User.findById(id).select(PUBLIC_USER_FIELDS).populate({ path: "roleId", select: "name" }).lean();
}

/**
 * Resolves any "organize this championship" invite sent to this email into a real co-organizer, now that
 * the email has a real account. Shared by both sign-in paths (Google's `jwt` callback in `src/auth.ts`,
 * and credentials registration in `src/lib/services/auth.ts`) so the invite logic lives in one place.
 */
export async function resolveOrganizerInvites(userId: Types.ObjectId | string, email: string): Promise<void> {
  await Championship.updateMany(
    { organizerInviteEmails: email },
    { $addToSet: { organizerUserIds: userId }, $pull: { organizerInviteEmails: email } }
  );
}

/**
 * Whether the signed-in person still exists, and what they may do (their role's set; everything for an admin).
 * A session outlives the account it was issued for (it is a signed token), so a deleted account must stop working
 * here: `null` means "no such user", and the request is treated as signed out.
 */
export async function loadSessionUser(userId: string, isAdmin: boolean): Promise<{ permissions: Permission[] } | null> {
  const user = await User.findById(userId).select("roleId isAdmin").lean();
  if (!user) return null;
  if (isAdmin || user.isAdmin) return { permissions: [...ALL_PERMISSIONS] };
  if (!user.roleId) return { permissions: [] };
  const role = await Role.findById(user.roleId).select("permissions").lean();
  return { permissions: role?.permissions ?? [] };
}

const DELETED_USER_NAME = "Usuario eliminado";

/** What deleting the account would touch, for the confirmation text on the profile page. */
export async function accountDeletionImpact(userId: string) {
  const owned = await Championship.find({ ownerUserId: userId, demoOwnerUserId: { $exists: false } }, "organizerUserIds").lean();
  const orphaned = owned.filter((championship) => (championship.organizerUserIds ?? []).length === 0).length;
  return { ownedChampionships: owned.length, withoutCoOrganizer: orphaned };
}

/**
 * Deletes a person's own account and the personal data tied to it. Championships are shared work, so they stay:
 * a co-organizer takes over as owner when there is one (otherwise the championship is left to the admins), and the
 * person's demo copies are removed. Their name is wiped from match records (check-ins, verifications) and their usage
 * events are deleted. The audit log is immutable by design (see `AuditLog`) and keeps the name of who did what.
 */
export async function deleteOwnAccount(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw conflict("Esta cuenta ya no existe", "gone");
  if (user.isAdmin && (await User.countDocuments({ isAdmin: true })) <= 1) {
    throw conflict("Eres el único administrador: nombra a otro antes de eliminar tu cuenta", "last_admin");
  }

  const demos = await Championship.find({ demoOwnerUserId: userId }, "_id").lean();
  for (const { _id } of demos) await deleteDemo(_id);

  const owned = await Championship.find({ ownerUserId: userId }, "organizerUserIds").lean();
  for (const championship of owned) {
    const [next, ...rest] = championship.organizerUserIds ?? [];
    await Championship.updateOne(
      { _id: championship._id },
      next ? { $set: { ownerUserId: next, organizerUserIds: rest } } : { $unset: { ownerUserId: "" } }
    );
  }
  await Championship.updateMany(
    { $or: [{ organizerUserIds: userId }, { organizerInviteEmails: user.email }] },
    { $pull: { organizerUserIds: user._id, organizerInviteEmails: user.email } }
  );

  await Promise.all([
    PlayerCheckIn.updateMany({ operatorUserId: userId }, { $set: { operatorName: DELETED_USER_NAME, operatorUserId: null } }),
    IdentityVerification.updateMany({ operatorUserId: userId }, { $set: { operatorName: DELETED_USER_NAME, operatorUserId: null } }),
    Player.updateMany({ createdByUserId: userId }, { $set: { createdByUserId: null } }),
    UsageEvent.deleteMany({ userId }),
    purgeUserNotifications(userId),
  ]);

  await user.deleteOne();
}

/** What a person followed, was notified about and the devices registered for pop-ups: gone with the account. */
export async function purgeUserNotifications(userId: string): Promise<void> {
  await Promise.all([Follow.deleteMany({ userId }), Notification.deleteMany({ userId }), PushSubscription.deleteMany({ userId })]);
}

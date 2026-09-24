import { Types } from "mongoose";
import type { Permission } from "@/lib/roles";
import { ALL_PERMISSIONS } from "@/lib/roles";
import { Championship } from "@/models/Championship";
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

/** The permissions a signed-in, non-admin user has: their assigned role's set, or none without one. */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const user = await User.findById(userId).select("roleId isAdmin").lean();
  if (!user) return [];
  if (user.isAdmin) return [...ALL_PERMISSIONS];
  if (!user.roleId) return [];
  const role = await Role.findById(user.roleId).select("permissions").lean();
  return role?.permissions ?? [];
}

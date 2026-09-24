import { ALL_PERMISSIONS, CHAMPIONSHIP_ADMIN_ROLE_NAME, ORGANIZER_PERMISSIONS, SYSTEM_ROLE_NAME } from "@/lib/roles";
import { Role } from "@/models/Role";

/** Creates the two default roles if they don't exist yet; leaves them alone (and their permissions) otherwise. */
export async function ensureDefaultRoles(): Promise<{ systemRoleId: string; championshipAdminRoleId: string }> {
  const [system, championshipAdmin] = await Promise.all([
    Role.findOneAndUpdate(
      { name: SYSTEM_ROLE_NAME },
      { $setOnInsert: { permissions: [...ALL_PERMISSIONS] } },
      { upsert: true, new: true }
    ),
    Role.findOneAndUpdate(
      { name: CHAMPIONSHIP_ADMIN_ROLE_NAME },
      { $setOnInsert: { permissions: [...ORGANIZER_PERMISSIONS] } },
      { upsert: true, new: true }
    ),
  ]);
  return { systemRoleId: system._id.toString(), championshipAdminRoleId: championshipAdmin._id.toString() };
}

/** The role a brand-new account gets: able to create and run its own championships right away. */
export async function getDefaultRoleIdForNewUser(): Promise<string> {
  const { championshipAdminRoleId } = await ensureDefaultRoles();
  return championshipAdminRoleId;
}

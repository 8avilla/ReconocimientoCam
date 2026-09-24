/**
 * Roles for trying the app from each point of view. There is no login yet: the role is a selector kept in the
 * browser, so this only shapes what each screen shows; the API does not enforce it.
 *
 * - visitor: follows championships (read-only, can follow with the star).
 * - organizer: runs championships; sees everything a visitor sees plus the organizing tools.
 * - admin: manages the app itself and everything else.
 */
export const ROLES = ["visitor", "organizer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { visitor: "Visitante", organizer: "Organizador", admin: "Administrador" };
export const ROLE_DESCRIPTION: Record<Role, string> = {
  visitor: "Sigue campeonatos: consulta partidos, resultados, tablas y estadísticas, y marca favoritos. Solo lectura.",
  organizer: "Todo lo del visitante, más organizar el campeonato: fases, calendario, equipos, plantillas, asistencia, eventos y sanciones.",
  admin: "Gestiona la app y todo lo demás: además de lo del organizador, elimina campeonatos y consulta el registro de actividad.",
};

/** Every permission that exists — the single source of truth, so it doubles as a runtime list (the roles
 * CRUD's checkboxes, zod enum validation) and, via `(typeof ALL_PERMISSIONS)[number]`, the `Permission` type. */
export const ALL_PERMISSIONS = [
  "championship.manage",
  "championship.delete",
  "match.manage",
  "match.operate",
  "team.manage",
  "roster.manage",
  "player.manage",
  "sanction.manage",
  "app.manage",
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

/**
 * For now the app only really needs two roles: a system-wide one and one for whoever runs a championship.
 * Both are still plain rows in the Roles CRUD (an admin can rename them, change their permissions, or add
 * more roles later) — these names are just seeded once (see `src/lib/services/roles.ts`) so every account
 * starts with a sensible one, and shared here (not in that server-only file) so client code — the "new
 * user" form's default selection — can reference the name without importing a Mongoose model.
 */
export const SYSTEM_ROLE_NAME = "Sistema";
export const CHAMPIONSHIP_ADMIN_ROLE_NAME = "Administrador de campeonato";

/** The permissions a championship organizer has — also what the seeded "Administrador de campeonato" role grants (see `src/lib/services/roles.ts`). */
export const ORGANIZER_PERMISSIONS: readonly Permission[] = ["championship.manage", "match.manage", "match.operate", "team.manage", "roster.manage", "player.manage", "sanction.manage"];
const PERMISSIONS: Record<Role, readonly Permission[]> = {
  visitor: [],
  organizer: ORGANIZER_PERMISSIONS,
  admin: [...ORGANIZER_PERMISSIONS, "championship.delete", "app.manage"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

const within = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Section pages inside a championship, mapped to the legacy paths the access rules were written for. */
const SECTION_AS_LEGACY: Record<string, string> = {
  partidos: "/matches",
  clasificacion: "/stats",
  equipos: "/teams",
  jugadores: "/players",
  sanciones: "/sanctions",
  gestionar: "/championships/manage",
};

/** Screens each role can open. */
export function canAccess(role: Role, rawPath: string): boolean {
  let pathname = rawPath;
  const scoped = /^\/c\/[^/]+(?:\/([^/]+))?/.exec(rawPath);
  if (scoped) pathname = scoped[1] ? SECTION_AS_LEGACY[scoped[1]] ?? "/" : "/";
  if (within(pathname, "/admin")) return role === "admin";
  if (role !== "visitor") return true;
  // A visitor reads the championship: no setup pages, no personal data of players.
  if (pathname === "/" || pathname === "/championships") return true;
  return ["/matches", "/stats", "/phases", "/teams", "/sanctions", "/attendance"].some((prefix) => within(pathname, prefix));
}

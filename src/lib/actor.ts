import type { NextRequest } from "next/server";

export type ActorRole = "admin" | "championship_admin" | "delegate" | "referee";

export interface Actor {
  /** Authenticated user id; null while authentication is not enabled. */
  userId: string | null;
  name: string;
  role: ActorRole;
}

/**
 * Resolves who performs a request. Authentication is deferred, so every request is attributed
 * to a system administrator. This is the single place to replace with session lookup
 * (cookie -> User) once credentials-based login is enabled.
 */
export function getActor(request: NextRequest): Actor {
  // The "view as" selector sends its role so the audit trail says who was acting; it grants nothing.
  const viewRole = request.headers.get("x-view-role");
  if (viewRole === "organizer") return { userId: null, name: "Sistema (Organizador)", role: "championship_admin" };
  if (viewRole === "visitor") return { userId: null, name: "Sistema (Visitante)", role: "delegate" };
  return { userId: null, name: "Sistema", role: "admin" };
}

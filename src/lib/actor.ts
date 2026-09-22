import type { NextRequest } from "next/server";
import { currentActor } from "./requestContext";

/**
 * `admin` manages the app and everything in it. `organizer` is a signed-in person who owns or was invited
 * to organize one or more championships (checked per championship with `requireOrganizer`, not by this
 * role alone). `visitor` covers both a signed-out browser and a signed-in person with no organizer role.
 */
export type ActorRole = "admin" | "organizer" | "visitor";

export interface Actor {
  /** The signed-in user's id, or null while signed out. */
  userId: string | null;
  name: string;
  role: ActorRole;
  /** Real admin flag from the session (ADMIN_EMAILS), independent of `role`'s label. */
  isAdmin: boolean;
}

export const SYSTEM_ACTOR: Actor = { userId: null, name: "Sistema", role: "admin", isAdmin: true };

/**
 * Who is making the current request. `route()` (in `src/lib/api.ts`) resolves this once per request from
 * the real Google session (see `src/auth.ts`) and stashes it so every call site keeps this same sync,
 * request-argument signature — nothing else needs to change or await it.
 */
export function getActor(request: NextRequest): Actor {
  void request;
  return currentActor() ?? { userId: null, name: "Visitante", role: "visitor", isAdmin: false };
}

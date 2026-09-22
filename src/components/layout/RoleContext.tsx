"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { can as roleCan, type Permission, type Role } from "@/lib/roles";
import { useChampionship } from "./ChampionshipContext";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  isAdmin: boolean;
}

interface Organized {
  ownerUserId?: string;
  organizerUserIds: string[];
}

interface RoleContextValue {
  status: "loading" | "unauthenticated" | "authenticated";
  user: SessionUser | null;
  /** Any signed-in Google account: enough to start a new championship (they become its owner). */
  isSignedIn: boolean;
  /** The signed-in person's role for the championship currently in view (from `useChampionship().current`). */
  role: Role;
  can: (permission: Permission) => boolean;
  /** For lists that show many championships at once (not just "current"): can this signed-in person manage that one? */
  canManageChampionship: (item: Organized) => boolean;
  signIn: () => void;
  signOut: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

/** Real roles, from the Google session (see `src/auth.ts`) and who owns/organizes the championship in view. Replaces the old "Ver como…" preview: what you can do here is what the server will actually let you do. */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { current } = useChampionship();

  const value = useMemo<RoleContextValue>(() => {
    const sessionUser = session?.user;
    const user: SessionUser | null = sessionUser?.id ? { id: sessionUser.id, name: sessionUser.name ?? sessionUser.email ?? "", email: sessionUser.email ?? "", image: sessionUser.image, isAdmin: sessionUser.isAdmin } : null;

    const canManageChampionship = (item: Organized) =>
      Boolean(user) && (user!.isAdmin || item.ownerUserId === user!.id || (item.organizerUserIds ?? []).includes(user!.id));

    const role: Role = user?.isAdmin ? "admin" : user && current && canManageChampionship(current) ? "organizer" : "visitor";

    return {
      status,
      user,
      isSignedIn: Boolean(user),
      role,
      can: (permission) => roleCan(role, permission),
      canManageChampionship,
      signIn: () => void nextAuthSignIn("google"),
      signOut: () => void nextAuthSignOut(),
    };
  }, [session, status, current]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used inside RoleProvider");
  return context;
}

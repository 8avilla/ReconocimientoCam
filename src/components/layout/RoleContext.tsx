"use client";

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { can as roleCan, ROLES, type Permission, type Role } from "@/lib/roles";

export const ROLE_STORAGE_KEY = "super-torneos:role";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  can: (permission: Permission) => boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered when storage is unavailable.
  }
}

const ROLE_EVENT = "super-torneos:role-change";

function subscribe(notify: () => void) {
  window.addEventListener(ROLE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(ROLE_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  // Read through useSyncExternalStore so the server render (admin) and the first client render agree; the stored role applies right after hydration.
  const stored = useSyncExternalStore(subscribe, () => read(ROLE_STORAGE_KEY), () => null);
  const role: Role = ROLES.find((item) => item === stored) ?? "admin";

  const setRole = useCallback((next: Role) => {
    write(ROLE_STORAGE_KEY, next);
    window.dispatchEvent(new Event(ROLE_EVENT));
  }, []);

  const value = useMemo<RoleContextValue>(() => ({ role, setRole, can: (permission) => roleCan(role, permission) }), [role, setRole]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used inside RoleProvider");
  return context;
}

"use client";

import { SessionProvider } from "next-auth/react";

/** Thin client wrapper: `SessionProvider` itself must run on the client. */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  // No re-check each time the window gets focus: the session is read once, and again only when it changes.
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}

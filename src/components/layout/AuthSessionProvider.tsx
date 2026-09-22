"use client";

import { SessionProvider } from "next-auth/react";

/** Thin client wrapper: `SessionProvider` itself must run on the client. */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

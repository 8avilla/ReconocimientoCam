"use client";

import { signOut as nextAuthSignOut } from "next-auth/react";
import { disablePush } from "./push";
import { getOutbox } from "./useOutbox";

/**
 * Signs out and wipes what the service worker kept for this person (pages and data), so nothing of theirs stays
 * on a shared phone. Changes still waiting to be synced are not wiped: they are asked about first.
 */
export async function signOutAndClear(options: { callbackUrl?: string } = {}): Promise<void> {
  const waiting = getOutbox().getState().pending.length;
  if (waiting > 0 && !window.confirm(`Tienes ${waiting} ${waiting === 1 ? "cambio" : "cambios"} de asistencia sin enviar. Se enviarán cuando vuelvas a iniciar sesión con conexión. ¿Cerrar sesión?`)) return;
  // This device must stop receiving the previous person's pop-ups (needs the session, so before signing out).
  await disablePush().catch(() => undefined);
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-caches");
  } catch {
    // No service worker (development, unsupported browser): nothing to clear.
  }
  await nextAuthSignOut(options);
}

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { http } from "./http";
import { createOutbox, type OutboxState } from "./outbox";

type Outbox = ReturnType<typeof createOutbox>;

const EMPTY: OutboxState = { pending: [], rejected: [], syncedCount: 0, needsSignIn: false, flushing: false };
let instance: Outbox | null = null;

/** The device's queue of changes made offline: one per browser, created on first use. */
export function getOutbox(): Outbox {
  if (!instance) {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      // Storage blocked: the queue lives in memory until the page closes.
    }
    instance = createOutbox({ storage, send: (path, payload) => http(path, { json: payload }) });
  }
  return instance;
}

export function useOutbox(): OutboxState {
  return useSyncExternalStore(
    (listener) => getOutbox().subscribe(listener),
    () => getOutbox().getState(),
    () => EMPTY
  );
}

/** Registers an attendance change: sent now, or queued on this device when there is no connection. */
export function submitAttendance<T>(matchId: string, path: string, payload: Record<string, unknown>) {
  return getOutbox().submit<T>(matchId, path, payload, navigator.onLine);
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener("online", listener);
      window.addEventListener("offline", listener);
      return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
      };
    },
    () => navigator.onLine,
    () => true
  );
}

/** Replays the queue whenever it can succeed: back online, app brought to the front, and every 20 s while something waits. */
export function useOutboxSync() {
  const online = useOnline();
  const { pending, flushing } = useOutbox();
  const hasPending = pending.length > 0;

  useEffect(() => {
    if (!online) return;
    const flush = () => void getOutbox().flush();
    flush();
    const onVisible = () => document.visibilityState === "visible" && flush();
    document.addEventListener("visibilitychange", onVisible);
    const timer = hasPending ? setInterval(flush, 20000) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearInterval(timer);
    };
  }, [online, hasPending]);

  return { online, flushing };
}

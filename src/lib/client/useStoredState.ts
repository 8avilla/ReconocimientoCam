"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const EVENT = "super-torneos:stored-state-change";

function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * useState that remembers its value in localStorage (a string). Safe for server-rendered pages: read through
 * useSyncExternalStore, so the server and the client's first paint agree (no hydration mismatch) and the
 * stored value applies right after hydration instead of via a lazy initializer. `allowed` discards a stored
 * value that is no longer valid. `forced` (e.g. from the URL) wins over the stored value and is remembered.
 */
export function useStoredState<T extends string>(key: string, initial: T, allowed?: (value: string) => boolean, forced?: T): [T, (value: T) => void] {
  const getSnapshot = useCallback(() => {
    if (forced !== undefined) return forced;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key, forced]);
  // `forced` comes from a prop (the URL), known at server render time too, so the server snapshot can honor it;
  // the stored value cannot (it lives in the browser), so the server snapshot falls back to `initial` for it.
  const getServerSnapshot = useCallback(() => (forced !== undefined ? forced : null), [forced]);
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = stored !== null && (!allowed || allowed(stored)) ? (stored as T) : initial;

  // A forced value is remembered so it is still applied (as the plain stored value) after leaving the page.
  useEffect(() => {
    if (forced === undefined) return;
    try {
      if (window.localStorage.getItem(key) !== forced) window.localStorage.setItem(key, forced);
    } catch {
      // Not remembered when storage is unavailable.
    }
  }, [forced, key]);

  const set = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not remembered when storage is unavailable.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key]
  );

  return [value, set];
}

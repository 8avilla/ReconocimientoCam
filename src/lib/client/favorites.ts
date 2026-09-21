"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const FAVORITE_TEAMS_KEY = "super-torneos:favorite-teams";
const EVENT = "super-torneos:favorites-change";

function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/** Ids the user follows under `key` (kept in this browser until accounts exist); shared by every component using the key. */
export function useFavoriteSet(key: string): [ReadonlySet<string>, (id: string) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]"
  );
  const ids = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        // Not remembered when storage is unavailable.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [ids, key]
  );
  return [ids, toggle];
}

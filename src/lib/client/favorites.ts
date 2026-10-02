"use client";

import { useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { FollowTargetType } from "@/lib/constants";
import { FollowContext } from "./followContext";

export const FAVORITE_CHAMPIONSHIPS_KEY = "super-torneos:favorites";
export const FAVORITE_TEAMS_KEY = "super-torneos:favorite-teams";
export const FAVORITE_PLAYERS_KEY = "super-torneos:favorite-players";
const EVENT = "super-torneos:favorites-change";

/** The three kinds of things that can be followed, by where each is kept in this browser. */
export const FOLLOW_KEYS: Record<FollowTargetType, string> = {
  championship: FAVORITE_CHAMPIONSHIPS_KEY,
  team: FAVORITE_TEAMS_KEY,
  player: FAVORITE_PLAYERS_KEY,
};
const TYPE_OF_KEY = Object.fromEntries(Object.entries(FOLLOW_KEYS).map(([type, key]) => [key, type as FollowTargetType]));

/** What this browser has followed (signed out). */
export function readLocalFollows(): Record<FollowTargetType, string[]> {
  const read = (key: string): string[] => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  };
  return { championship: read(FOLLOW_KEYS.championship), team: read(FOLLOW_KEYS.team), player: read(FOLLOW_KEYS.player) };
}

/** After signing in, what was followed here now lives in the account: the browser's copy must not bring it back later. */
export function clearLocalFollows(): void {
  try {
    for (const key of Object.values(FOLLOW_KEYS)) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was kept anyway.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * Ids followed under `key`: in the account when signed in (that is what notifications use), otherwise kept in this
 * browser. Shared by every component using the key.
 */
export function useFavoriteSet(key: string): [ReadonlySet<string>, (id: string) => void] {
  const context = useContext(FollowContext);
  const [localIds, toggleLocal] = useLocalFavoriteSet(key);
  const type = TYPE_OF_KEY[key];
  const toggleRemote = useCallback((id: string) => context?.toggle(type, id), [context, type]);
  if (context?.server && type) return [context.server[type], toggleRemote];
  return [localIds, toggleLocal];
}

function useLocalFavoriteSet(key: string): [ReadonlySet<string>, (id: string) => void] {
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

"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useFavoriteSet } from "@/lib/client/favorites";
import { useFetch } from "@/lib/client/useFetch";
import { parseChampionshipPath } from "@/lib/paths";
import type { ChampionshipDTO, Paginated } from "@/types/api";

const STORAGE_KEY = "super-torneos:championship";
const SELECTION_EVENT = "super-torneos:championship-change";
export const FAVORITES_KEY = "super-torneos:favorites";

interface ChampionshipContextValue {
  championships: ChampionshipDTO[];
  /**
   * The championship being looked at: the one in the address (`/c/<id>/…`) or, on detail pages that have no
   * championship in their address, the last one visited. Null until one exists (or when the address has an unknown id).
   */
  current: ChampionshipDTO | null;
  /** Id in the address, if any (so a wrong link can be told apart from "no championship yet"). */
  routeId: string | null;
  /** Remembers a championship as the last visited. */
  setCurrentId: (id: string) => void;
  /** Championships the user follows (kept in this browser until accounts exist). */
  favoriteIds: ReadonlySet<string>;
  toggleFavorite: (id: string) => void;
  loading: boolean;
  error?: Error;
  reload: () => void;
}

const ChampionshipContext = createContext<ChampionshipContextValue | null>(null);

function subscribeSelection(notify: () => void) {
  window.addEventListener(SELECTION_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(SELECTION_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

function readSelection(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberSelection(id: string) {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === id) return;
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage may be unavailable (private mode); it just won't be remembered.
  }
  window.dispatchEvent(new Event(SELECTION_EVENT));
}

export function ChampionshipProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, reload } = useFetch<Paginated<ChampionshipDTO>>("/championships?limit=100");
  const [favoriteIds, toggleFavorite] = useFavoriteSet(FAVORITES_KEY);
  const pathname = usePathname();
  const routeId = parseChampionshipPath(pathname)?.id ?? null;
  const selectedId = useSyncExternalStore(subscribeSelection, readSelection, () => null);

  const championships = useMemo(() => data?.data ?? [], [data]);
  const matchInList = routeId ? championships.find((item) => item._id === routeId || item.slug === routeId) ?? null : null;
  // The bulk list only carries public championships (plus ones this user owns/organizes) and real ids never
  // match a slug string — a private-but-linked championship or a `/c/<slug>` address needs its own direct fetch.
  const needsFallback = Boolean(routeId) && !loading && !matchInList;
  const fallback = useFetch<ChampionshipDTO>(needsFallback ? `/championships/${routeId}` : null);

  // Visiting a championship makes it the "last visited" one, which detail pages (a match, a team...) fall back to.
  useEffect(() => {
    if (routeId) rememberSelection(routeId);
  }, [routeId]);

  const setCurrentId = useCallback((id: string) => rememberSelection(id), []);

  const value = useMemo<ChampionshipContextValue>(() => {
    const current = routeId
      ? matchInList ?? fallback.data ?? null
      : championships.find((item) => item._id === selectedId) ?? championships.find((item) => favoriteIds.has(item._id)) ?? championships[0] ?? null;
    return {
      championships,
      current,
      routeId,
      setCurrentId,
      favoriteIds,
      toggleFavorite,
      loading: loading || (needsFallback && fallback.loading),
      error: error ?? (needsFallback ? fallback.error : undefined),
      reload,
    };
  }, [championships, routeId, matchInList, fallback.data, fallback.loading, fallback.error, needsFallback, selectedId, setCurrentId, favoriteIds, toggleFavorite, loading, error, reload]);

  return <ChampionshipContext.Provider value={value}>{children}</ChampionshipContext.Provider>;
}

export function useChampionship(): ChampionshipContextValue {
  const context = useContext(ChampionshipContext);
  if (!context) throw new Error("useChampionship must be used inside ChampionshipProvider");
  return context;
}

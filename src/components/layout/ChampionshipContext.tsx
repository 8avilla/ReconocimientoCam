"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useFetch } from "@/lib/client/useFetch";
import type { ChampionshipDTO, Paginated } from "@/types/api";

const STORAGE_KEY = "super-torneos:championship";
const FAVORITES_KEY = "super-torneos:favorites";

interface ChampionshipContextValue {
  championships: ChampionshipDTO[];
  /** Championship every list screen is scoped to; null until one exists. */
  current: ChampionshipDTO | null;
  setCurrentId: (id: string) => void;
  /** Championships the user follows (kept in this browser until accounts exist). */
  favoriteIds: ReadonlySet<string>;
  toggleFavorite: (id: string) => void;
  loading: boolean;
  error?: Error;
  reload: () => void;
}

const ChampionshipContext = createContext<ChampionshipContextValue | null>(null);

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readFavorites(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function ChampionshipProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, reload } = useFetch<Paginated<ChampionshipDTO>>("/championships?limit=100");
  const [selectedId, setSelectedId] = useState<string | null>(() => (typeof window === "undefined" ? null : readStoredId()));

  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(() => (typeof window === "undefined" ? new Set() : readFavorites()));

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // Not persisted when storage is unavailable.
      }
      return next;
    });
  }, []);

  const setCurrentId = useCallback((id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage may be unavailable (private mode); the selection just won't persist.
    }
  }, []);

  const value = useMemo<ChampionshipContextValue>(() => {
    const championships = data?.data ?? [];
    // Without a remembered choice the app opens on a followed championship, then on the first one.
    const current = championships.find((item) => item._id === selectedId) ?? championships.find((item) => favoriteIds.has(item._id)) ?? championships[0] ?? null;
    return { championships, current, setCurrentId, favoriteIds, toggleFavorite, loading, error, reload };
  }, [data, selectedId, setCurrentId, favoriteIds, toggleFavorite, loading, error, reload]);

  return <ChampionshipContext.Provider value={value}>{children}</ChampionshipContext.Provider>;
}

export function useChampionship(): ChampionshipContextValue {
  const context = useContext(ChampionshipContext);
  if (!context) throw new Error("useChampionship must be used inside ChampionshipProvider");
  return context;
}

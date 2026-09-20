"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useFetch } from "@/lib/client/useFetch";
import type { ChampionshipDTO, Paginated } from "@/types/api";

const STORAGE_KEY = "super-torneos:championship";

interface ChampionshipContextValue {
  championships: ChampionshipDTO[];
  /** Championship every list screen is scoped to; null until one exists. */
  current: ChampionshipDTO | null;
  setCurrentId: (id: string) => void;
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

export function ChampionshipProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, reload } = useFetch<Paginated<ChampionshipDTO>>("/championships?limit=100");
  const [selectedId, setSelectedId] = useState<string | null>(() => (typeof window === "undefined" ? null : readStoredId()));

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
    const current = championships.find((item) => item._id === selectedId) ?? championships[0] ?? null;
    return { championships, current, setCurrentId, loading, error, reload };
  }, [data, selectedId, setCurrentId, loading, error, reload]);

  return <ChampionshipContext.Provider value={value}>{children}</ChampionshipContext.Provider>;
}

export function useChampionship(): ChampionshipContextValue {
  const context = useContext(ChampionshipContext);
  if (!context) throw new Error("useChampionship must be used inside ChampionshipProvider");
  return context;
}

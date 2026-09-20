"use client";

import React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { EmptyState, ErrorState, Loading } from "@/components/ui";
import { useChampionship } from "./ChampionshipContext";
import type { ChampionshipDTO } from "@/types/api";

/** Renders its children only once a championship is selected; handles loading, error and empty states. */
export function RequireChampionship({ children }: { children: (championship: ChampionshipDTO) => React.ReactNode }) {
  const { current, loading, error, reload } = useChampionship();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading && !current) return <Loading />;
  if (!current) {
    return (
      <EmptyState
        icon={<Trophy size={28} />}
        title="Aún no hay campeonatos"
        description="Crea un campeonato para empezar a registrar equipos y jugadores."
        action={<Link href="/championships" className="btn primary">Crear campeonato</Link>}
      />
    );
  }
  return <>{children(current)}</>;
}

"use client";

import React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { EmptyState, ErrorState, Loading } from "@/components/ui";
import { useChampionship } from "./ChampionshipContext";
import type { ChampionshipDTO } from "@/types/api";

/** Renders its children only once a championship is selected; handles loading, error and empty states. */
export function RequireChampionship({ children }: { children: (championship: ChampionshipDTO) => React.ReactNode }) {
  const { current, routeId, loading, error, reload } = useChampionship();
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading && !current) return <Loading />;
  if (!current && routeId) {
    return (
      <EmptyState
        icon={<Trophy size={28} />}
        title="No encontramos ese campeonato"
        description="Puede que el enlace esté mal o que el campeonato ya no exista."
        action={<Link href="/" className="btn primary">Ver campeonatos</Link>}
      />
    );
  }
  if (!current) {
    return (
      <EmptyState
        icon={<Trophy size={28} />}
        title="Aún no hay campeonatos"
        description="Crea un campeonato para empezar a registrar equipos y jugadores."
        action={<Link href="/" className="btn primary">Crear campeonato</Link>}
      />
    );
  }
  return <>{children(current)}</>;
}

"use client";

import { CalendarDays } from "lucide-react";
import { MatchList } from "@/components/match/MatchList";
import { EmptyState, ErrorState, Loading } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchDTO, Paginated } from "@/types/api";


/** Finished matches ("results") or the ones still to play ("fixtures"), grouped by phase; of one team, or of the whole championship without `teamId`. */
export function TeamMatchesTab({ teamId, championshipId, kind }: { teamId?: string; championshipId: string; kind: "results" | "fixtures" }) {
  const { data, error, loading, reload } = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}${teamId ? `&teamId=${teamId}` : ""}&limit=100`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  const all = data?.data ?? [];
  const matches = kind === "results"
    ? all.filter((match) => match.status === "finished").sort((a, b) => new Date(b.scheduledAt ?? 0).getTime() - new Date(a.scheduledAt ?? 0).getTime())
    : all.filter((match) => match.status !== "finished");

  if (matches.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={kind === "results" ? "Aún no hay resultados" : "No hay partidos por jugar"}
          description={kind === "results" ? "Aquí aparecerán los partidos finalizados." : "Aquí aparecerán los próximos partidos."}
        />
      </div>
    );
  }

  return <MatchList matches={matches} teamId={teamId} />;
}

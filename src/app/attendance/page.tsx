"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { MatchStatusBadge } from "@/components/match/MatchStatusBadge";
import { Avatar, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import { formatDateTime } from "@/lib/labels";
import type { MatchDTO, Paginated } from "@/types/api";

export default function AttendanceIndexPage() {
  return <RequireChampionship>{(championship) => <OpenMatches championshipId={championship._id} />}</RequireChampionship>;
}

function OpenMatches({ championshipId }: { championshipId: string }) {
  const scheduled = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&limit=100`);
  const live = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=live&limit=100`);

  const error = scheduled.error ?? live.error;
  const matches = [...(live.data?.data ?? []), ...(scheduled.data?.data ?? [])];
  const loading = (!scheduled.data || !live.data) && !error;

  return (
    <>
      <PageHeader title="Asistencia" description="Elige el partido para registrar asistencia y verificar jugadores." />
      {error ? (
        <ErrorState message={error.message} onRetry={() => { scheduled.reload(); live.reload(); }} />
      ) : loading ? (
        <Loading />
      ) : matches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CalendarDays size={28} />}
            title="No hay partidos abiertos"
            description="Programa un partido para registrar la asistencia de las plantillas."
            action={<Link href="/matches" className="btn primary">Ir a partidos</Link>}
          />
        </div>
      ) : (
        <div className="card flush">
          {matches.map((match) => (
            <Link key={match._id} href={`/matches/${match._id}?tab=attendance`} className="list-row">
              <Avatar src={match.homeTeamId.shieldUrl} name={match.homeTeamId.name} size={40} square />
              <Avatar src={match.awayTeamId.shieldUrl} name={match.awayTeamId.name} size={40} square />
              <div className="grow">
                <div className="text-strong truncate">{match.homeTeamId.name} vs {match.awayTeamId.name}</div>
                <div className="text-secondary text-small">{formatDateTime(match.scheduledAt)}{match.venue && ` · ${match.venue}`}</div>
              </div>
              <MatchStatusBadge status={match.status} />
              <ChevronRight size={20} aria-hidden color="var(--color-text-disabled)" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

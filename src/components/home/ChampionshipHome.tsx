"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Goal, MapPin } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { MyTeams } from "@/components/home/MyTeams";
import { SetupChecklist } from "@/components/home/SetupChecklist";
import { LiveMatchesBanner } from "@/components/match/LiveMatchesBanner";
import { MatchList } from "@/components/match/MatchList";
import { PlayerRanking } from "@/components/stats/StatsView";
import { TeamStandingsTab } from "@/components/team/TeamStandingsTab";
import { Avatar, Badge, EmptyState } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import { championshipPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import type { ChampionshipDTO, MatchDTO, OverviewDTO, Paginated, PlayerStatsDTO } from "@/types/api";

export function ChampionshipHome() {
  return <RequireChampionship>{(championship) => <Dashboard championship={championship} />}</RequireChampionship>;
}

function Dashboard({ championship }: { championship: ChampionshipDTO }) {
  const { _id: championshipId, name, season, logoUrl, status } = championship;
  // Stable timestamp: a new value on every render would change the request path endlessly.
  const [now] = useState(() => new Date().toISOString());
  const upcoming = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&from=${encodeURIComponent(now)}&order=date&limit=4`);
  const recent = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&played=true&order=date&limit=100`);
  const stats = useFetch<PlayerStatsDTO>(`/championships/${championshipId}/stats`);
  const { can } = useRole();
  const overview = useFetch<OverviewDTO>(`/championships/${championshipId}/overview`);
  const statusInfo = CHAMPIONSHIP_STATUS_LABEL[status];

  const nextMatches = upcoming.data?.data ?? [];
  const nextMatch = nextMatches[0];
  // "played=true&order=date" comes oldest-first; the most recent results are the last ones.
  const lastResults = [...(recent.data?.data ?? [])].reverse().slice(0, 4);
  const topScorers = stats.data?.scorers.slice(0, 5) ?? [];

  return (
    <>
      <section className="champ-hero" aria-label="Torneo">
        <div className="champ-hero-pattern" aria-hidden />
        <Goal className="champ-hero-icon" aria-hidden size={220} strokeWidth={1} />
        <div className="champ-hero-top">
          {logoUrl ? (
            <Avatar src={logoUrl} name={name} size={64} square />
          ) : (
            <span className="hero-tile" aria-hidden><Goal size={36} /></span>
          )}
          <div className="stack-sm grow" style={{ minWidth: 0 }}>
            <h1 style={{ color: "#fff" }}>{name}</h1>
            <div className="champ-hero-badges">
              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
              <Badge tone="neutral"><Goal size={12} aria-hidden /> Temporada {season}</Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="stack" style={{ gap: "var(--space-2xl)" }}>
        <LiveMatchesBanner championshipId={championshipId} />
        {overview.data && can("championship.manage") && <SetupChecklist championshipId={championshipId} overview={overview.data} />}

        <div className="home-row-2">
          <section aria-label="Próximo partido">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2>Próximo partido</h2>
              <Link href={championshipPath(championshipId, "partidos")} className="btn ghost small">Ver calendario</Link>
            </div>
            {nextMatch ? (
              <div className="card featured match-spotlight stack">
                <div style={{ textAlign: "center" }}>
                  <span className="phase-chip" style={{ display: "inline-flex" }}>
                    {nextMatch.matchdayId.name} · {nextMatch.phaseId.name}
                  </span>
                </div>
                <div className="match-spotlight-teams">
                  <TeamSide name={nextMatch.homeTeamId.name} shieldUrl={nextMatch.homeTeamId.shieldUrl} />
                  <span className="match-spotlight-vs" aria-hidden>VS</span>
                  <TeamSide name={nextMatch.awayTeamId.name} shieldUrl={nextMatch.awayTeamId.shieldUrl} />
                </div>
                <div className="match-spotlight-meta">
                  {nextMatch.scheduledAt && (
                    <span className="match-spotlight-chip">
                      <CalendarDays size={14} aria-hidden />
                      {new Date(nextMatch.scheduledAt).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {nextMatch.venue && (
                    <span className="match-spotlight-chip"><MapPin size={14} aria-hidden /> {nextMatch.venue}</span>
                  )}
                </div>
                <Link href={`/matches/${nextMatch._id}`} className="btn primary block">Ver detalles del partido</Link>
              </div>
            ) : (
              <div className="card text-secondary">No hay partidos programados.</div>
            )}
          </section>

          <section aria-label="Tabla de posiciones">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2>Tabla de posiciones</h2>
              <Link href={championshipPath(championshipId, "clasificacion")} className="btn ghost small">Ver clasificación</Link>
            </div>
            <TeamStandingsTab championshipId={championshipId} maxRows={5} phaseSelector={false} />
          </section>
        </div>

        <div className="home-row-3">
          <section aria-label="Últimos resultados">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2 style={{ fontSize: 17 }}>Últimos resultados</h2>
              <Link href={championshipPath(championshipId, "partidos")} className="btn ghost small">Ver todos</Link>
            </div>
            {lastResults.length === 0 ? (
              <div className="card text-secondary">Aún no hay resultados.</div>
            ) : (
              <MatchList matches={lastResults} />
            )}
          </section>

          <section aria-label="Goleadores">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2 style={{ fontSize: 17 }}>Goleadores</h2>
              <Link href={championshipPath(championshipId, "clasificacion")} className="btn ghost small">Ver todos</Link>
            </div>
            {topScorers.length === 0 ? (
              <div className="card"><EmptyState icon={<Goal size={28} />} title="Sin goles todavía" description="Se llenará cuando se jueguen partidos." /></div>
            ) : (
              <PlayerRanking rows={topScorers} empty="Sin goles todavía" value={(row) => row.goals} unit="goles" extra={() => ""} />
            )}
          </section>

          <section aria-label="Próximos partidos">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2 style={{ fontSize: 17 }}>Próximos partidos</h2>
              <Link href={championshipPath(championshipId, "partidos")} className="btn ghost small">Ver calendario</Link>
            </div>
            {nextMatches.length === 0 ? (
              <div className="card text-secondary">No hay partidos programados.</div>
            ) : (
              <MatchList matches={nextMatches} />
            )}
          </section>
        </div>

        <MyTeams championshipId={championshipId} />
      </div>
    </>
  );
}

function TeamSide({ name, shieldUrl }: { name: string; shieldUrl: string }) {
  return (
    <div className="stack-sm" style={{ alignItems: "center", textAlign: "center" }}>
      <Avatar src={shieldUrl} name={name} size={64} square />
      <span className="text-strong">{name}</span>
    </div>
  );
}

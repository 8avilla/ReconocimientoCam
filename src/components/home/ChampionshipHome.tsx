"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Trophy, MapPin } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { AttentionList } from "@/components/home/AttentionList";
import { MyTeams } from "@/components/home/MyTeams";
import { SetupChecklist } from "@/components/home/SetupChecklist";
import { TeamStandingsTab } from "@/components/team/TeamStandingsTab";
import { Avatar, Badge } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import { championshipPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import type { ChampionshipDTO, MatchDTO, OverviewDTO, Paginated } from "@/types/api";

export function ChampionshipHome() {
  return <RequireChampionship>{(championship) => <Dashboard championship={championship} />}</RequireChampionship>;
}

function Dashboard({ championship }: { championship: ChampionshipDTO }) {
  const { _id: championshipId, name, season, logoUrl, status } = championship;
  // Stable timestamp: a new value on every render would change the request path endlessly.
  const [now] = useState(() => new Date().toISOString());
  const matches = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&from=${encodeURIComponent(now)}&order=date&limit=1`);
  const nextMatch = matches.data?.data[0];
  const { can } = useRole();
  const overview = useFetch<OverviewDTO>(`/championships/${championshipId}/overview`);
  const statusInfo = CHAMPIONSHIP_STATUS_LABEL[status];

  return (
    <>
      <section className="champ-hero" aria-label="Campeonato">
        <div className="champ-hero-pattern" aria-hidden />
        <div className="champ-hero-top">
          {logoUrl ? (
            <Avatar src={logoUrl} name={name} size={64} square />
          ) : (
            <span className="hero-tile" aria-hidden><Trophy size={36} /></span>
          )}
          <div className="stack-sm grow" style={{ minWidth: 0 }}>
            <h1 style={{ color: "#fff" }}>{name}</h1>
            <div className="champ-hero-badges">
              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
              <Badge tone="neutral"><Trophy size={12} aria-hidden /> Temporada {season}</Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="stack" style={{ gap: "var(--space-2xl)" }}>
          {overview.data && can("championship.manage") && <SetupChecklist championshipId={championshipId} overview={overview.data} />}
          {overview.data && can("championship.manage") && <AttentionList championshipId={championshipId} overview={overview.data} />}
          <section aria-label="Clasificación">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2>Clasificación</h2>
              <Link href={championshipPath(championshipId, "clasificacion")} className="btn ghost small">Ver todo</Link>
            </div>
            <TeamStandingsTab championshipId={championshipId} maxRows={8} qualifyCount={4} />
          </section>

          <section aria-label="Próximo partido">
            <h2 style={{ marginBottom: "var(--space-md)" }}>Próximo partido estelar</h2>
            {nextMatch ? (
              <div className="card featured match-spotlight stack">
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
                <Link href={`/matches/${nextMatch._id}`} className="btn primary block">Ir al partido</Link>
              </div>
            ) : (
              <div className="card text-secondary">No hay partidos programados.</div>
            )}
          </section>

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

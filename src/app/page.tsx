"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Shield, Trophy, Users } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { AttentionList } from "@/components/home/AttentionList";
import { MyTeams } from "@/components/home/MyTeams";
import { SetupChecklist } from "@/components/home/SetupChecklist";
import { TeamMatchesTab } from "@/components/team/TeamMatchesTab";
import { TeamStandingsTab } from "@/components/team/TeamStandingsTab";
import { Avatar, Button } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import type { MatchDTO, OverviewDTO, Paginated } from "@/types/api";

export default function DashboardPage() {
  return <RequireChampionship>{(championship) => <Dashboard championshipId={championship._id} name={championship.name} season={championship.season} />}</RequireChampionship>;
}

type HomeTab = "summary" | "standings" | "results" | "fixtures";
const TABS: { id: HomeTab; label: string }[] = [
  { id: "summary", label: "Resumen" },
  { id: "standings", label: "Clasificación" },
  { id: "results", label: "Resultados" },
  { id: "fixtures", label: "Partidos" },
];

function Dashboard({ championshipId, name, season }: { championshipId: string; name: string; season: string }) {
  // Stable timestamp: a new value on every render would change the request path endlessly.
  const [now] = useState(() => new Date().toISOString());
  const teams = useFetch<Paginated<unknown>>(`/teams?championshipId=${championshipId}&limit=1`);
  const players = useFetch<Paginated<unknown>>(`/players?championshipId=${championshipId}&limit=1`);
  const matches = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&from=${encodeURIComponent(now)}&order=date&limit=1`);
  const nextMatch = matches.data?.data[0];
  const { can } = useRole();
  const [tab, setTab] = useStoredState<HomeTab>("super-torneos:home:tab", "summary", (value) => TABS.some((item) => item.id === value));
  const overview = useFetch<OverviewDTO>(`/championships/${championshipId}/overview`);

  const summary = [
    { label: "Equipos", value: teams.data?.meta.total, icon: Shield, href: "/teams" },
    { label: "Jugadores", value: players.data?.meta.total, icon: Users, href: "/players" },
    { label: "Próximos", value: matches.data?.meta.total, icon: CalendarDays, href: "/matches" },
  ];

  return (
    <>
      <section className="team-hero" aria-label="Campeonato">
        <span className="hero-tile" aria-hidden><Trophy size={36} /></span>
        <div className="stack-sm grow" style={{ minWidth: 0 }}>
          <h1>{name}</h1>
          <span className="text-secondary">Temporada {season}</span>
          <div className="row-wrap" style={{ gap: 12 }}>
            {summary.map(({ label, value, icon: Icon, href }) => (
              <Link key={label} href={href} className="text-secondary text-small row" style={{ gap: 4 }}>
                <Icon size={14} aria-hidden /> <span className="text-strong">{value ?? "–"}</span> {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="tabs-line" role="tablist" aria-label="Secciones del campeonato">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="stack" style={{ gap: "var(--space-2xl)" }}>
          {overview.data && can("championship.manage") && <SetupChecklist championshipId={championshipId} overview={overview.data} />}
          {overview.data && can("championship.manage") && <AttentionList championshipId={championshipId} overview={overview.data} />}
          <section aria-label="Clasificación">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2>Clasificación</h2>
              <Button variant="ghost" size="small" onClick={() => setTab("standings")}>Ver todo</Button>
            </div>
            <TeamStandingsTab championshipId={championshipId} maxRows={8} />
          </section>

          <section aria-label="Próximo partido">
            <h2 style={{ marginBottom: "var(--space-md)" }}>Próximo partido</h2>
            {nextMatch ? (
              <Link href={`/matches/${nextMatch._id}`} className="card featured interactive stack">
                <div className="row-between" style={{ justifyContent: "space-around" }}>
                  <TeamSide name={nextMatch.homeTeamId.name} shieldUrl={nextMatch.homeTeamId.shieldUrl} />
                  <span className="text-strong text-secondary">VS</span>
                  <TeamSide name={nextMatch.awayTeamId.name} shieldUrl={nextMatch.awayTeamId.shieldUrl} />
                </div>
                <p className="text-secondary" style={{ textAlign: "center" }}>
                  {nextMatch.scheduledAt && new Date(nextMatch.scheduledAt).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {nextMatch.venue && <> · <MapPin size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> {nextMatch.venue}</>}
                </p>
              </Link>
            ) : (
              <div className="card text-secondary">No hay partidos programados.</div>
            )}
          </section>

          <MyTeams championshipId={championshipId} />
        </div>
      )}
      {tab === "standings" && <TeamStandingsTab championshipId={championshipId} />}
      {tab === "results" && <TeamMatchesTab championshipId={championshipId} kind="results" />}
      {tab === "fixtures" && <TeamMatchesTab championshipId={championshipId} kind="fixtures" />}
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

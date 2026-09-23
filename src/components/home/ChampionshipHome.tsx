"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Pencil, Settings, Shield, Trophy, MapPin, Users } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { AttentionList } from "@/components/home/AttentionList";
import { ChampionshipFormModal } from "@/components/championship/ChampionshipFormModal";
import { MyTeams } from "@/components/home/MyTeams";
import { SetupChecklist } from "@/components/home/SetupChecklist";
import { TeamStandingsTab } from "@/components/team/TeamStandingsTab";
import { Avatar, Button } from "@/components/ui";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { useRole } from "@/components/layout/RoleContext";
import { championshipPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import type { ChampionshipDTO, MatchDTO, OverviewDTO, Paginated } from "@/types/api";

export function ChampionshipHome() {
  return <RequireChampionship>{(championship) => <Dashboard championship={championship} />}</RequireChampionship>;
}

function Dashboard({ championship }: { championship: ChampionshipDTO }) {
  const { _id: championshipId, name, season, logoUrl } = championship;
  // Stable timestamp: a new value on every render would change the request path endlessly.
  const [now] = useState(() => new Date().toISOString());
  const teams = useFetch<Paginated<unknown>>(`/teams?championshipId=${championshipId}&limit=1`);
  const players = useFetch<Paginated<unknown>>(`/players?championshipId=${championshipId}&limit=1`);
  const matches = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&from=${encodeURIComponent(now)}&order=date&limit=1`);
  const nextMatch = matches.data?.data[0];
  const { can } = useRole();
  const { reload: reloadChampionship } = useChampionship();
  const [editOpen, setEditOpen] = useState(false);
  const overview = useFetch<OverviewDTO>(`/championships/${championshipId}/overview`);

  const summary = [
    { label: "Equipos", value: teams.data?.meta.total, icon: Shield, href: championshipPath(championshipId, "equipos") },
    { label: "Jugadores", value: players.data?.meta.total, icon: Users, href: championshipPath(championshipId, "jugadores") },
    { label: "Próximos", value: matches.data?.meta.total, icon: CalendarDays, href: championshipPath(championshipId, "partidos") },
  ];
  const manage = can("championship.manage");

  return (
    <>
      <section className="team-hero rounded" aria-label="Campeonato" style={{ marginBottom: "var(--space-2xl)" }}>
        {logoUrl ? (
          <Avatar src={logoUrl} name={name} size={64} square />
        ) : (
          <span className="hero-tile" aria-hidden><Trophy size={36} /></span>
        )}
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
        {manage && (
          <div className="row-wrap" style={{ flexShrink: 0 }}>
            <Button variant="secondary" size="small" icon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>Editar</Button>
            <Link href={championshipPath(championshipId, "gestionar")} className="btn secondary small">
              <Settings size={16} aria-hidden /> Gestionar
            </Link>
          </div>
        )}
      </section>

      {manage && (
        <ChampionshipFormModal
          open={editOpen}
          championship={championship}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            reloadChampionship();
          }}
        />
      )}

      <div className="stack" style={{ gap: "var(--space-2xl)" }}>
          {overview.data && can("championship.manage") && <SetupChecklist championshipId={championshipId} overview={overview.data} />}
          {overview.data && can("championship.manage") && <AttentionList championshipId={championshipId} overview={overview.data} />}
          <section aria-label="Clasificación">
            <div className="row-between" style={{ marginBottom: "var(--space-md)" }}>
              <h2>Clasificación</h2>
              <Link href={championshipPath(championshipId, "clasificacion")} className="btn ghost small">Ver todo</Link>
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

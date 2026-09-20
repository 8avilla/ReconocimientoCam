"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, MapPin, Shield, Users } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { Avatar, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchDTO, Paginated } from "@/types/api";

export default function DashboardPage() {
  return <RequireChampionship>{(championship) => <Dashboard championshipId={championship._id} name={championship.name} season={championship.season} />}</RequireChampionship>;
}

function Dashboard({ championshipId, name, season }: { championshipId: string; name: string; season: string }) {
  // Stable timestamp: a new value on every render would change the request path endlessly.
  const [now] = useState(() => new Date().toISOString());
  const teams = useFetch<Paginated<unknown>>(`/teams?championshipId=${championshipId}&limit=1`);
  const players = useFetch<Paginated<unknown>>(`/players?championshipId=${championshipId}&limit=1`);
  const matches = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&from=${encodeURIComponent(now)}&limit=1`);
  const nextMatch = matches.data?.data[0];

  const summary = [
    { label: "Equipos", value: teams.data?.meta.total, icon: Shield, href: "/teams" },
    { label: "Jugadores", value: players.data?.meta.total, icon: Users, href: "/players" },
    { label: "Partidos programados", value: matches.data?.meta.total, icon: CalendarDays, href: "/matches" },
  ];

  return (
    <>
      <PageHeader title={name} description={`Temporada ${season}`} />

      <div className="stack" style={{ gap: "var(--space-2xl)" }}>
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
                {new Date(nextMatch.scheduledAt).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {nextMatch.venue && <> · <MapPin size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> {nextMatch.venue}</>}
              </p>
            </Link>
          ) : (
            <div className="card text-secondary">No hay partidos programados.</div>
          )}
        </section>

        <section aria-label="Resumen">
          <h2 style={{ marginBottom: "var(--space-md)" }}>Resumen</h2>
          <div className="card-grid">
            {summary.map(({ label, value, icon: Icon, href }) => (
              <Link key={label} href={href} className="card interactive row">
                <Icon size={28} color="var(--color-primary)" aria-hidden />
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{value ?? "–"}</div>
                  <div className="text-secondary">{label}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section aria-label="Acciones rápidas">
          <h2 style={{ marginBottom: "var(--space-md)" }}>Acciones rápidas</h2>
          <div className="row-wrap">
            <Link href="/players/new" className="btn primary large"><Users size={20} aria-hidden /> Registrar jugador</Link>
            <Link href="/attendance" className="btn secondary large"><ClipboardCheck size={20} aria-hidden /> Asistencia</Link>
          </div>
        </section>
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

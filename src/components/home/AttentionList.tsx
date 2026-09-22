"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, CircleDot, ScanFace, Shield, Swords } from "lucide-react";
import { championshipPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchDTO, OverviewDTO, Paginated } from "@/types/api";

const timeOf = (value?: string | null) => (value ? new Date(value).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");

/** What needs attention now: matches in play or today, and gaps in the setup (undated matches, teams outside any phase, players without face). */
export function AttentionList({ championshipId, overview }: { championshipId: string; overview: OverviewDTO }) {
  // Stable day bounds: a new value on every render would change the request path endlessly.
  const [today] = useState(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  });
  const live = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=live&limit=10`);
  const todays = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&from=${encodeURIComponent(today.from)}&to=${encodeURIComponent(today.to)}&order=date&limit=10`);

  const items: { key: string; icon: React.ReactNode; tone: "live" | "today" | "todo"; text: string; detail?: string; href: string; action: string }[] = [
    ...(live.data?.data ?? []).map((match) => ({
      key: `live-${match._id}`, icon: <CircleDot size={20} />, tone: "live" as const,
      text: `En juego: ${match.homeTeamId.name} ${match.homeScore ?? 0} – ${match.awayScore ?? 0} ${match.awayTeamId.name}`,
      href: `/matches/${match._id}?tab=events`, action: "Registrar",
    })),
    ...(todays.data?.data ?? []).map((match) => ({
      key: `today-${match._id}`, icon: <Swords size={20} />, tone: "today" as const,
      text: `Hoy ${timeOf(match.scheduledAt)}: ${match.homeTeamId.name} vs ${match.awayTeamId.name}`,
      href: `/matches/${match._id}?tab=attendance`, action: "Asistencia",
    })),
    ...(overview.unscheduledMatches > 0
      ? [{ key: "unscheduled", icon: <CalendarClock size={20} />, tone: "todo" as const, text: `${overview.unscheduledMatches} ${overview.unscheduledMatches === 1 ? "partido sin día ni hora" : "partidos sin día ni hora"}`, href: championshipPath(championshipId, "partidos", "?programacion=sin"), action: "Programar" }]
      : []),
    ...(overview.teamsWithoutPhase.length > 0
      ? [{
          key: "no-phase", icon: <Shield size={20} />, tone: "todo" as const,
          text: `${overview.teamsWithoutPhase.length} ${overview.teamsWithoutPhase.length === 1 ? "equipo no está" : "equipos no están"} en ninguna fase`,
          detail: overview.teamsWithoutPhase.map((team) => team.name).join(", "), href: championshipPath(championshipId, "gestionar"), action: "Agregar",
        }]
      : []),
    ...(overview.playersWithoutFace > 0
      ? [{ key: "faces", icon: <ScanFace size={20} />, tone: "todo" as const, text: `${overview.playersWithoutFace} ${overview.playersWithoutFace === 1 ? "jugador sin rostro registrado" : "jugadores sin rostro registrado"}`, href: championshipPath(championshipId, "jugadores"), action: "Ver" }]
      : []),
  ];
  if (items.length === 0) return null;

  return (
    <section aria-label="Requiere tu atención">
      <h2 style={{ marginBottom: "var(--space-md)" }}>Requiere tu atención</h2>
      <div className="flush-list">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className="list-row attention-row">
            <span className={`attention-icon ${item.tone}`} aria-hidden>{item.icon}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="text-strong">{item.text}</div>
              {item.detail && <div className="text-secondary text-small truncate">{item.detail}</div>}
            </div>
            <span className="text-small text-strong" style={{ color: "var(--color-primary)" }}>{item.action}</span>
            <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { Avatar } from "@/components/ui";
import { FAVORITE_TEAMS_KEY, useFavoriteSet } from "@/lib/client/favorites";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchDTO, Paginated, TeamDTO } from "@/types/api";

/** The teams the user follows in this championship, each with its next match. Hidden when none is followed. */
export function MyTeams({ championshipId }: { championshipId: string }) {
  const [favorites] = useFavoriteSet(FAVORITE_TEAMS_KEY);
  const teams = useFetch<Paginated<TeamDTO>>(favorites.size > 0 ? `/teams?championshipId=${championshipId}&limit=100` : null);
  const upcoming = useFetch<Paginated<MatchDTO>>(favorites.size > 0 ? `/matches?championshipId=${championshipId}&status=scheduled&order=date&limit=100` : null);

  const mine = (teams.data?.data ?? []).filter((team) => favorites.has(team._id));
  if (mine.length === 0) return null;

  // Dated matches first (they come ordered by day), then the ones still without day and time.
  const dated = (upcoming.data?.data ?? []).filter((match) => match.scheduledAt);
  const undated = (upcoming.data?.data ?? []).filter((match) => !match.scheduledAt);
  const nextOf = (teamId: string) => [...dated, ...undated].find((match) => match.homeTeamId._id === teamId || match.awayTeamId._id === teamId);

  return (
    <section aria-label="Mis equipos">
      <h2 style={{ marginBottom: "var(--space-md)" }}>Mis equipos</h2>
      <div className="flush-list">
        <h3 className="band band-favorite band-small"><Star size={12} fill="currentColor" aria-hidden style={{ verticalAlign: "-1px" }} /> Equipos que sigues ({mine.length})</h3>
        {mine.map((team) => {
          const next = nextOf(team._id);
          const rival = next ? (next.homeTeamId._id === team._id ? next.awayTeamId : next.homeTeamId) : null;
          const when = next?.scheduledAt
            ? new Date(next.scheduledAt).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
            : "por definir";
          return (
            <Link key={team._id} href={`/teams/${team._id}`} className="list-row">
              <Avatar src={team.shieldUrl} name={team.name} size={44} square />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="champ-caption truncate">{next && rival ? `Próximo: vs ${rival.name} · ${when}` : "Sin próximo partido"}</div>
                <div className="champ-name truncate">{team.name}</div>
              </div>
              <ChevronRight size={20} aria-hidden color="var(--color-text-disabled)" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

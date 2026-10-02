"use client";

import { useEffect, useState } from "react";
import { MatchList } from "@/components/match/MatchList";
import { dayBounds } from "@/lib/client/time";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchDTO, Paginated } from "@/types/api";

const REFRESH_MS = 30_000;

/**
 * Matches in play right now and the ones scheduled for today, on top of the championship home and its matches
 * list, so whoever is at the field gets to "Registrar" in one tap. Renders nothing when there is neither.
 */
export function LiveMatchesBanner({ championshipId, spaced }: { championshipId: string; /** Adds space below (only when it renders). */ spaced?: boolean }) {
  // Stable day bounds: new values on each render would change the request path endlessly.
  const [day] = useState(dayBounds);
  const live = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=live&order=date&limit=10`);
  const today = useFetch<Paginated<MatchDTO>>(`/matches?championshipId=${championshipId}&status=scheduled&from=${day.from}&to=${day.to}&order=date&limit=20`);

  const liveMatches = live.data?.data ?? [];
  const todayMatches = today.data?.data ?? [];
  const reloadLive = live.reload;
  const reloadToday = today.reload;

  // Scores and periods move during a match: keep the banner fresh while one is in play (or may start soon).
  const refreshing = liveMatches.length > 0 || todayMatches.length > 0;
  useEffect(() => {
    if (!refreshing) return;
    const timer = setInterval(() => {
      reloadLive();
      reloadToday();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshing, reloadLive, reloadToday]);

  if (liveMatches.length === 0 && todayMatches.length === 0) return null;
  return (
    <div className="stack" style={{ gap: "var(--space-lg)", marginBottom: spaced ? "var(--space-lg)" : undefined }}>
      {liveMatches.length > 0 && (
        <section aria-label="Partidos en vivo">
          <h2 style={{ marginBottom: "var(--space-md)" }}>En vivo ahora</h2>
          <MatchList matches={liveMatches} />
        </section>
      )}
      {todayMatches.length > 0 && (
        <section aria-label="Partidos de hoy">
          <h2 style={{ marginBottom: "var(--space-md)" }}>Hoy</h2>
          <MatchList matches={todayMatches} />
        </section>
      )}
    </div>
  );
}

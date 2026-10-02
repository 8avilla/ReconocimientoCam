"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Avatar, useToast } from "@/components/ui";
import { FAVORITE_TEAMS_KEY, useFavoriteSet } from "@/lib/client/favorites";
import { suggestedMinute } from "@/lib/rules/match";
import { formatDateTime, MATCH_PERIOD_LABEL, matchLabel } from "@/lib/labels";
import { MatchStatusBadge } from "./MatchStatusBadge";
import type { MatchDTO } from "@/types/api";

function Side({
  teamId,
  name,
  shieldUrl,
  favorite,
  onToggleFavorite,
}: {
  teamId: string;
  name: string;
  shieldUrl: string;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="stack-sm" style={{ alignItems: "center", textAlign: "center", minWidth: 0, flex: "1 1 0" }}>
      {/* Shield, name and star stacked: side by side they did not fit on 360 px phones, where the centre column squeezed the shield into a sliver. */}
      <Link href={`/teams/${teamId}`} style={{ display: "flex", flexShrink: 0 }}><Avatar src={shieldUrl} name={name} size={44} square /></Link>
      <Link href={`/teams/${teamId}`} style={{ fontSize: 13, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere", minHeight: 39 }}>{name}</Link>
      <button
        type="button"
        className={`star-button${favorite ? " on" : ""}`}
        aria-pressed={favorite}
        aria-label={favorite ? `Dejar de seguir a ${name}` : `Seguir a ${name}`}
        onClick={onToggleFavorite}
      >
        <Star size={16} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/** Teams, live score, period and running minute (or kickoff time before the match starts). */
export function MatchScoreboard({ match }: { match: MatchDTO }) {
  const [now, setNow] = useState(() => Date.now());
  const playing = match.status === "live" && (match.period === "first_half" || match.period === "second_half");
  const toast = useToast();
  const [favoriteTeams, toggleFavoriteTeam] = useFavoriteSet(FAVORITE_TEAMS_KEY);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [playing]);

  function toggleFavorite(teamId: string, name: string) {
    toggleFavoriteTeam(teamId);
    toast.success(favoriteTeams.has(teamId) ? `Dejaste de seguir a ${name}` : `Ahora sigues a ${name}`);
  }

  const started = match.status === "live" || match.status === "finished" || match.status === "walkover";
  return (
    <section className="card featured stack" aria-label="Marcador">
      <div className="text-secondary text-small" style={{ textAlign: "center" }}>{formatDateTime(match.scheduledAt)}</div>
      <div className="row-between" style={{ alignItems: "center" }}>
        <Side
          teamId={match.homeTeamId._id}
          name={match.homeTeamId.name}
          shieldUrl={match.homeTeamId.shieldUrl}
          favorite={favoriteTeams.has(match.homeTeamId._id)}
          onToggleFavorite={() => toggleFavorite(match.homeTeamId._id, match.homeTeamId.name)}
        />
        <div className="stack-sm" style={{ alignItems: "center", textAlign: "center", flex: "0 1 54%", minWidth: 0 }}>
          {started && (
            <div
              style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontFamily: "ui-monospace, 'SF Mono', 'Roboto Mono', Consolas, monospace", fontVariantNumeric: "tabular-nums" }}
              aria-label={`Marcador ${match.homeScore ?? 0} a ${match.awayScore ?? 0}`}
            >
              {match.homeScore ?? 0} – {match.awayScore ?? 0}
            </div>
          )}
          <MatchStatusBadge status={match.status} />
          {playing && (
            <span className="text-secondary">
              {MATCH_PERIOD_LABEL[match.period]} · {`${suggestedMinute(match.period, match.periodStartedAt, new Date(now))}'`}
            </span>
          )}
          {matchLabel(match) && <span className="text-secondary text-small">{matchLabel(match)}</span>}
          {match.venue && <span className="text-secondary text-small"><MapPin size={12} aria-hidden /> {match.venue}</span>}
          {match.refereeId && <span className="text-secondary text-small">Árbitro: {match.refereeId.fullName}</span>}
        </div>
        <Side
          teamId={match.awayTeamId._id}
          name={match.awayTeamId.name}
          shieldUrl={match.awayTeamId.shieldUrl}
          favorite={favoriteTeams.has(match.awayTeamId._id)}
          onToggleFavorite={() => toggleFavorite(match.awayTeamId._id, match.awayTeamId.name)}
        />
      </div>
    </section>
  );
}

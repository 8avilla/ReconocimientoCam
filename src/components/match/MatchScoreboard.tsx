"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/ui";
import { suggestedMinute } from "@/lib/rules/match";
import { formatDateTime, MATCH_PERIOD_LABEL, matchLabel } from "@/lib/labels";
import { MatchStatusBadge } from "./MatchStatusBadge";
import type { MatchDTO } from "@/types/api";

function Side({ name, shieldUrl }: { name: string; shieldUrl: string }) {
  return (
    <div className="stack-sm" style={{ alignItems: "center", textAlign: "center", minWidth: 0, flex: 1 }}>
      <Avatar src={shieldUrl} name={name} size={72} square />
      <span className="text-strong">{name}</span>
    </div>
  );
}

/** Teams, live score, period and running minute (or kickoff time before the match starts). */
export function MatchScoreboard({ match }: { match: MatchDTO }) {
  const [now, setNow] = useState(() => Date.now());
  const playing = match.status === "live" && (match.period === "first_half" || match.period === "second_half");

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [playing]);

  const started = match.status === "live" || match.status === "finished";
  return (
    <section className="card featured stack" aria-label="Marcador">
      <div className="row-between" style={{ alignItems: "center" }}>
        <Side name={match.homeTeamId.name} shieldUrl={match.homeTeamId.shieldUrl} />
        <div className="stack-sm" style={{ alignItems: "center", textAlign: "center" }}>
          <MatchStatusBadge status={match.status} />
          {started ? (
            <>
              <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }} aria-label={`Marcador ${match.homeScore ?? 0} a ${match.awayScore ?? 0}`}>
                {match.homeScore ?? 0} – {match.awayScore ?? 0}
              </div>
              <span className="text-secondary">
                {MATCH_PERIOD_LABEL[match.period]}
                {playing && ` · ${suggestedMinute(match.period, match.periodStartedAt, new Date(now))}'`}
              </span>
            </>
          ) : (
            <span className="text-strong">{formatDateTime(match.scheduledAt)}</span>
          )}
          {matchLabel(match) && <span className="text-secondary text-small">{matchLabel(match)}</span>}
          {match.venue && <span className="text-secondary text-small"><MapPin size={12} aria-hidden /> {match.venue}</span>}
          {match.refereeId && <span className="text-secondary text-small">Árbitro: {match.refereeId.fullName}</span>}
        </div>
        <Side name={match.awayTeamId.name} shieldUrl={match.awayTeamId.shieldUrl} />
      </div>
    </section>
  );
}

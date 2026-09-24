"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Goal } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, ErrorState, Loading } from "@/components/ui";
import { EventIcon } from "@/components/match/EventIcon";
import { useFetch } from "@/lib/client/useFetch";
import { formatDate, MATCH_STATUS_LABEL } from "@/lib/labels";
import type { Paginated, PlayerMatchActivityDTO } from "@/types/api";

const PAGE_SIZE = 15;

/**
 * Matches this player was called up for, newest first. Only what the app can actually know today
 * (call-up, score, this player's own goals/cards) — no "titular" or minutes played, see the API route.
 */
export function PlayerMatchHistory({ playerId }: { playerId: string }) {
  const [pages, setPages] = useState(1);
  const { data, error, loading, reload } = useFetch<Paginated<PlayerMatchActivityDTO>>(`/players/${playerId}/matches?limit=${PAGE_SIZE * pages}`);
  const matches = data?.data ?? [];
  const hasMore = data ? matches.length < data.meta.total : false;

  return (
    <section className="flush-list" aria-label="Historial de partidos">
      <h2 className="band band-muted band-small">Historial de partidos</h2>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : matches.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Goal size={28} />} title="Sin partidos" description="Este jugador aún no ha sido convocado a ningún partido." />
        </div>
      ) : (
        <>
          <div className="table-wrap only-desktop">
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Competencia</th><th>Partido</th><th>Estado</th><th>Goles</th><th>Tarjetas</th></tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match._id}>
                    <td className="text-secondary">{formatDate(match.scheduledAt)}</td>
                    <td>{match.championship.name} {match.championship.season}</td>
                    <td><MatchCell match={match} /></td>
                    <td><Badge tone={MATCH_STATUS_LABEL[match.status].tone}>{MATCH_STATUS_LABEL[match.status].label}</Badge></td>
                    <td>{match.goals || "—"}</td>
                    <td><CardsCell match={match} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="only-mobile">
            {matches.map((match) => (
              <Link key={match._id} href={`/matches/${match._id}`} className="list-row">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="champ-caption truncate">{formatDate(match.scheduledAt)} · {match.championship.name} {match.championship.season}</div>
                  <MatchCell match={match} />
                  <div className="row-wrap" style={{ gap: 8, marginTop: 6 }}>
                    <Badge tone={MATCH_STATUS_LABEL[match.status].tone}>{MATCH_STATUS_LABEL[match.status].label}</Badge>
                    {match.goals > 0 && (
                      <span className="row" style={{ gap: 4, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: "var(--color-success-bg)", color: "var(--color-success)", fontWeight: 700 }}>
                        <Goal size={16} /> {match.goals}
                      </span>
                    )}
                    {(match.yellowCards > 0 || match.redCards > 0) && (
                      <span className="row" style={{ gap: 6, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: "var(--color-background)", fontWeight: 700 }}>
                        <CardsCell match={match} size={16} />
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={20} aria-hidden color="var(--color-text-disabled)" />
              </Link>
            ))}
          </div>

          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-lg)" }}>
              <Button variant="secondary" loading={loading} onClick={() => setPages((current) => current + 1)}>Mostrar más</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CardsCell({ match, size = 14 }: { match: PlayerMatchActivityDTO; size?: number }) {
  if (match.yellowCards === 0 && match.redCards === 0) return <>—</>;
  return (
    <span className="row" style={{ gap: 6 }}>
      {match.yellowCards > 0 && (
        <span className="row" style={{ gap: 3 }}><EventIcon type="yellow_card" size={size} /> {match.yellowCards}</span>
      )}
      {match.redCards > 0 && (
        <span className="row" style={{ gap: 3 }}><EventIcon type="red_card" size={size} /> {match.redCards}</span>
      )}
    </span>
  );
}

function MatchCell({ match }: { match: PlayerMatchActivityDTO }) {
  const started = match.status === "live" || match.status === "finished" || match.status === "walkover";
  return (
    <div className="stack-sm" style={{ gap: 4 }}>
      {[match.homeTeamId, match.awayTeamId].map((team, index) => (
        <div key={team._id} className="row" style={{ gap: 6, minWidth: 0 }}>
          <Avatar src={team.shieldUrl} name={team.name} size={20} square />
          <span className="truncate">{team.name}</span>
          {started && <span className="text-strong" style={{ marginLeft: "auto" }}>{index === 0 ? match.homeScore ?? 0 : match.awayScore ?? 0}</span>}
        </div>
      ))}
    </div>
  );
}

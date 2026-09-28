"use client";

import Link from "next/link";
import { Avatar, EmptyState, ErrorState, Loading } from "@/components/ui";
import { Form, StandingsTable } from "@/components/stats/StatsView";
import { formatDate } from "@/lib/labels";
import { useFetch } from "@/lib/client/useFetch";
import { CalendarClock } from "lucide-react";
import type { MatchDTO, Paginated, PhaseStandingsDTO, StandingsRowDTO } from "@/types/api";

interface Team {
  _id: string;
  name: string;
  shieldUrl: string;
}

/** One side of the "Forma" comparison: league position badge in the outer top corner, shield, name and
 * the last few results as colored pills. */
function FormCard({ team, row, align }: { team: Team; row: StandingsRowDTO; align: "left" | "right" }) {
  return (
    <Link href={`/teams/${team._id}`} className="form-vs-card" style={{ justifySelf: align === "left" ? "end" : "start" }}>
      <span className="form-vs-badge" style={{ [align === "left" ? "left" : "right"]: 6 }}>{row.position}.</span>
      <Avatar src={team.shieldUrl} name={team.name} size={40} square />
      <span className="text-strong truncate">{team.name}</span>
      <Form form={row.form} />
    </Link>
  );
}

/** Pre-match context for a game that hasn't been played yet: venue, each team's league position and
 * recent form, past meetings between them, and the standings table with both sides marked. */
export function MatchPreview({ match }: { match: MatchDTO }) {
  const standings = useFetch<PhaseStandingsDTO>(match.phaseId.type !== "knockout" ? `/phases/${match.phaseId._id}/standings` : null);
  const history = useFetch<Paginated<MatchDTO>>(
    `/matches?championshipId=${match.championshipId}&teamId=${match.homeTeamId._id}&played=true&order=date&limit=50`
  );

  if (standings.error) return <ErrorState message={standings.error.message} onRetry={standings.reload} />;
  if (history.error) return <ErrorState message={history.error.message} onRetry={history.reload} />;
  if (standings.loading || history.loading) return <Loading />;

  const table = standings.data?.tables.find((item) => (match.group ? item.group === match.group : true));
  const homeRow = table?.rows.find((row) => row.teamId === match.homeTeamId._id);
  const awayRow = table?.rows.find((row) => row.teamId === match.awayTeamId._id);

  const meetings = (history.data?.data ?? [])
    .filter((item) => item._id !== match._id && (item.homeTeamId._id === match.awayTeamId._id || item.awayTeamId._id === match.awayTeamId._id))
    .slice(0, 5);

  const hasAnything = Boolean(match.venue) || Boolean(homeRow && awayRow) || meetings.length > 0;
  if (!hasAnything) {
    return <div className="card"><EmptyState icon={<CalendarClock size={28} />} title="Aún no hay información previa" description="Aquí aparecerán el estadio, la forma reciente y los enfrentamientos anteriores." /></div>;
  }

  return (
    <div className="stack">
      {match.venue && (
        <div className="flush-list">
          <h2 className="band band-muted band-small">Información adicional</h2>
          <div className="list-row row-between">
            <span className="text-secondary">Estadio</span>
            <span className="text-strong">{match.venue}</span>
          </div>
        </div>
      )}

      {homeRow && awayRow && (
        <div className="flush-list">
          <h2 className="band band-muted band-small">Forma</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-lg)" }}>
            <FormCard team={match.homeTeamId} row={homeRow} align="left" />
            <span className="match-spotlight-vs">VS</span>
            <FormCard team={match.awayTeamId} row={awayRow} align="right" />
          </div>
        </div>
      )}

      {meetings.length > 0 && (
        <div className="flush-list">
          <h2 className="band band-muted band-small">Enfrentamientos</h2>
          {meetings.map((item) => (
            <Link key={item._id} href={`/matches/${item._id}`} className="list-row">
              <span className="text-secondary text-small" style={{ width: 64, flexShrink: 0 }}>{formatDate(item.scheduledAt)}</span>
              <div className="grow stack-sm" style={{ gap: 4, minWidth: 0 }}>
                <span className="row" style={{ gap: 6 }}><Avatar src={item.homeTeamId.shieldUrl} name={item.homeTeamId.name} size={20} square /><span className="truncate">{item.homeTeamId.name}</span></span>
                <span className="row" style={{ gap: 6 }}><Avatar src={item.awayTeamId.shieldUrl} name={item.awayTeamId.name} size={20} square /><span className="truncate">{item.awayTeamId.name}</span></span>
              </div>
              <div className="stack-sm text-strong" style={{ alignItems: "flex-end", flexShrink: 0 }}>
                <span>{item.homeScore ?? 0}</span>
                <span>{item.awayScore ?? 0}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {table && <StandingsTable rows={table.rows} title="Clasificación" highlightTeamId={[match.homeTeamId._id, match.awayTeamId._id]} />}
    </div>
  );
}

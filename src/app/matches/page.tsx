"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { MatchFormModal } from "@/components/match/MatchFormModal";
import { MatchStatusBadge } from "@/components/match/MatchStatusBadge";
import { Avatar, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { MATCH_STATUSES } from "@/lib/constants";
import { useFetch } from "@/lib/client/useFetch";
import { formatDateTime, MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO, Paginated } from "@/types/api";

export default function MatchesPage() {
  return <RequireChampionship>{(championship) => <MatchesList championshipId={championship._id} />}</RequireChampionship>;
}

function MatchesList({ championshipId }: { championshipId: string }) {
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const query = `/matches?championshipId=${championshipId}&limit=100${status ? `&status=${status}` : ""}`;
  const { data, error, loading, reload } = useFetch<Paginated<MatchDTO>>(query);
  const matches = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Partidos"
        description="Programación, asistencia y eventos de cada encuentro."
        actions={<Button icon={<Plus size={18} />} onClick={() => setFormOpen(true)}>Nuevo partido</Button>}
      />

      <select className="select" style={{ width: "auto", minWidth: 200, marginBottom: "var(--space-lg)" }} aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Todos los estados</option>
        {MATCH_STATUSES.map((item) => <option key={item} value={item}>{MATCH_STATUS_LABEL[item].label}</option>)}
      </select>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : matches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CalendarDays size={28} />}
            title={status ? "Sin resultados" : "Aún no hay partidos"}
            description={status ? "No hay partidos con ese estado." : "Programa el primer partido del campeonato."}
            action={!status && <Button onClick={() => setFormOpen(true)}>Crear partido</Button>}
          />
        </div>
      ) : (
        <div className="card-grid">
          {matches.map((match) => (
            <Link key={match._id} href={`/matches/${match._id}`} className="card interactive stack">
              <div className="row-between">
                <span className="text-secondary text-small">{match.round || "Sin jornada"}</span>
                <MatchStatusBadge status={match.status} />
              </div>
              <div className="row-between" style={{ justifyContent: "space-around" }}>
                <TeamSide name={match.homeTeamId.name} shieldUrl={match.homeTeamId.shieldUrl} />
                {match.status === "live" || match.status === "finished" ? (
                  <span className="text-strong" style={{ fontSize: 24 }} aria-label={`Marcador ${match.homeScore ?? 0} a ${match.awayScore ?? 0}`}>
                    {match.homeScore ?? 0} – {match.awayScore ?? 0}
                  </span>
                ) : (
                  <span className="text-strong text-secondary">VS</span>
                )}
                <TeamSide name={match.awayTeamId.name} shieldUrl={match.awayTeamId.shieldUrl} />
              </div>
              <p className="text-secondary text-small" style={{ textAlign: "center" }}>
                {formatDateTime(match.scheduledAt)}
                {match.venue && <> · <MapPin size={12} aria-hidden style={{ verticalAlign: "-1px" }} /> {match.venue}</>}
              </p>
            </Link>
          ))}
        </div>
      )}

      <MatchFormModal
        open={formOpen}
        championshipId={championshipId}
        match={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </>
  );
}

function TeamSide({ name, shieldUrl }: { name: string; shieldUrl: string }) {
  return (
    <div className="stack-sm" style={{ alignItems: "center", textAlign: "center", minWidth: 0 }}>
      <Avatar src={shieldUrl} name={name} size={56} square />
      <span className="text-strong">{name}</span>
    </div>
  );
}

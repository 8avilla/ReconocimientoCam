"use client";

import { useState } from "react";
import { ChartColumn } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { Avatar, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import type { PlayerStatDTO, PlayerStatsDTO, StandingsRowDTO } from "@/types/api";

type Tab = "standings" | "scorers" | "assists" | "cards";
const TABS: { id: Tab; label: string }[] = [
  { id: "standings", label: "Posiciones" },
  { id: "scorers", label: "Goleadores" },
  { id: "assists", label: "Asistencias" },
  { id: "cards", label: "Tarjetas" },
];

export default function StatsPage() {
  return <RequireChampionship>{(championship) => <Stats championshipId={championship._id} />}</RequireChampionship>;
}

function Stats({ championshipId }: { championshipId: string }) {
  const [tab, setTab] = useState<Tab>("standings");
  const standings = useFetch<{ data: StandingsRowDTO[] }>(`/championships/${championshipId}/standings`);
  const stats = useFetch<PlayerStatsDTO>(`/championships/${championshipId}/stats`);

  const active = tab === "standings" ? standings : stats;
  return (
    <>
      <PageHeader title="Estadísticas" description="Solo cuentan los partidos finalizados." />
      <div className="row-wrap" role="tablist" aria-label="Estadísticas" style={{ marginBottom: "var(--space-lg)" }}>
        {TABS.map((item) => (
          <Button key={item.id} role="tab" aria-selected={tab === item.id} variant={tab === item.id ? "primary" : "secondary"} onClick={() => setTab(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>

      {active.error ? (
        <ErrorState message={active.error.message} onRetry={active.reload} />
      ) : !active.data ? (
        <Loading />
      ) : tab === "standings" ? (
        <StandingsTable rows={standings.data?.data ?? []} />
      ) : tab === "scorers" ? (
        <PlayerRanking rows={stats.data?.scorers ?? []} empty="Aún no hay goles registrados." value={(row) => row.goals} unit="goles" extra={(row) => (row.assists ? `${row.assists} asist.` : "")} />
      ) : tab === "assists" ? (
        <PlayerRanking rows={stats.data?.assisters ?? []} empty="Aún no hay asistencias registradas." value={(row) => row.assists} unit="asist." extra={(row) => (row.goals ? `${row.goals} goles` : "")} />
      ) : (
        <PlayerRanking
          rows={stats.data?.cards ?? []}
          empty="Aún no hay tarjetas registradas."
          value={(row) => row.yellowCards + row.redCards}
          unit="tarjetas"
          extra={(row) => `${row.yellowCards} amarillas · ${row.redCards} rojas`}
        />
      )}
    </>
  );
}

const FORM_LABEL = { W: { text: "G", name: "Ganó", color: "var(--color-success)" }, D: { text: "E", name: "Empató", color: "var(--color-text-disabled)" }, L: { text: "P", name: "Perdió", color: "var(--color-error)" } } as const;

function Form({ form }: { form: StandingsRowDTO["form"] }) {
  return (
    <span className="row" style={{ gap: 4 }} aria-label={`Últimos resultados: ${form.map((result) => FORM_LABEL[result].name).join(", ") || "sin partidos"}`}>
      {form.map((result, index) => (
        <span key={index} aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", background: FORM_LABEL[result].color, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {FORM_LABEL[result].text}
        </span>
      ))}
    </span>
  );
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

function StandingsTable({ rows }: { rows: StandingsRowDTO[] }) {
  if (rows.length === 0) {
    return <div className="card"><EmptyState icon={<ChartColumn size={28} />} title="Sin equipos" description="Registra equipos y juega partidos para ver la tabla." /></div>;
  }
  return (
    <div className="card flush">
      <div className="table-wrap only-desktop">
        <table className="table">
          <thead>
            <tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Forma</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId}>
                <td className="text-strong">{row.position}</td>
                <td><span className="row"><Avatar src={row.shieldUrl} name={row.name} size={32} square /><span className="text-strong">{row.name}</span></span></td>
                <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td>
                <td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td>{signed(row.goalDifference)}</td>
                <td className="text-strong">{row.points}</td>
                <td><Form form={row.form} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="only-mobile">
        {rows.map((row) => (
          <div key={row.teamId} className="list-row">
            <span className="text-strong" style={{ width: 24 }}>{row.position}</span>
            <Avatar src={row.shieldUrl} name={row.name} size={40} square />
            <div className="grow">
              <div className="text-strong truncate">{row.name}</div>
              <div className="text-secondary text-small">PJ {row.played} · {row.won}G {row.drawn}E {row.lost}P · DG {signed(row.goalDifference)}</div>
              <Form form={row.form} />
            </div>
            <span style={{ fontSize: 24, fontWeight: 700 }} aria-label={`${row.points} puntos`}>{row.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerRanking({ rows, empty, value, unit, extra }: { rows: PlayerStatDTO[]; empty: string; value: (row: PlayerStatDTO) => number; unit: string; extra: (row: PlayerStatDTO) => string }) {
  if (rows.length === 0) {
    return <div className="card"><EmptyState icon={<ChartColumn size={28} />} title="Sin datos" description={empty} /></div>;
  }
  return (
    <div className="card flush">
      {rows.map((row, index) => (
        <div key={row.playerId} className="list-row">
          <span className="text-strong" style={{ width: 24 }}>{index + 1}</span>
          <Avatar src={row.photoUrl} name={row.fullName} size={44} />
          <div className="grow">
            <div className="text-strong truncate">{row.fullName}</div>
            <div className="text-secondary text-small truncate">{row.teamName}{extra(row) && ` · ${extra(row)}`}</div>
          </div>
          <span style={{ textAlign: "right" }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{value(row)}</span>
            <span className="text-secondary text-small"> {unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

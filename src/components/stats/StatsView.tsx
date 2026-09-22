"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { Avatar, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { championshipPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import { currentPhase } from "@/lib/rules/currentPhase";
import { useIsMobile } from "@/lib/client/useMediaQuery";
import { useStoredState } from "@/lib/client/useStoredState";
import type { PhaseDTO, PhaseStandingsDTO, PlayerStatDTO, PlayerStatsDTO, StandingsRowDTO } from "@/types/api";

type Tab = "standings" | "scorers" | "assists" | "yellow" | "red";
const TABS: { id: Tab; label: string }[] = [
  { id: "standings", label: "Clasificación" },
  { id: "scorers", label: "Goleadores" },
  { id: "assists", label: "Asistencias" },
  { id: "yellow", label: "Amarillas" },
  { id: "red", label: "Rojas" },
];

export function StatsView({ initialPhaseId }: { initialPhaseId?: string }) {
  return <RequireChampionship>{(championship) => <Stats championshipId={championship._id} initialPhaseId={initialPhaseId} />}</RequireChampionship>;
}

function Stats({ championshipId, initialPhaseId }: { championshipId: string; initialPhaseId?: string }) {
  const [tab, setTab] = useStoredState<Tab>("super-torneos:stats:tab", "standings", (value) => TABS.some((item) => item.id === value));
  const [phaseChoice, setPhaseChoice] = useStoredState<string>(`super-torneos:stats:phase:${championshipId}`, "", undefined, initialPhaseId);
  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${championshipId}/phases`);
  const phaseList = phases.data?.data ?? [];
  // With phases, the table belongs to one of them; without, it is the championship-wide table.
  const current = currentPhase(phaseList);
  const phase = phaseList.find((item) => item._id === phaseChoice) ?? current;
  const phaseStandings = useFetch<PhaseStandingsDTO>(phase && phase.type !== "knockout" ? `/phases/${phase._id}/standings` : null);
  const stats = useFetch<PlayerStatsDTO>(`/championships/${championshipId}/stats`);

  const active = tab === "standings" ? (phase && phase.type !== "knockout" ? phaseStandings : phases) : stats;
  return (
    <>
      <PageHeader title="Estadísticas" description="Solo cuentan los partidos finalizados." />
      <div className="tabs-line" role="tablist" aria-label="Estadísticas">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {active.error ? (
        <ErrorState message={active.error.message} onRetry={active.reload} />
      ) : !active.data ? (
        <Loading />
      ) : tab === "standings" ? (
        <>
          {phaseList.length > 0 && (
            <div className="phase-chips" role="tablist" aria-label="Fase">
              {[...phaseList].sort((a, b) => a.order - b.order).map((item) => (
                <button key={item._id} role="tab" aria-selected={phase?._id === item._id} className={`phase-chip${phase?._id === item._id ? " active" : ""}`} onClick={() => setPhaseChoice(item._id)}>
                  {item.name}
                  {current?._id === item._id && <span className="phase-chip-now">Actual</span>}
                </button>
              ))}
            </div>
          )}
          {phase?.type === "knockout" ? (
            <div className="card">
              <EmptyState icon={<ChartColumn size={28} />} title="Las eliminatorias no tienen tabla" description="Sus resultados se ven en las llaves de la fase." action={<Link href={`/phases/${phase._id}`} className="btn primary">Ver llaves</Link>} />
            </div>
          ) : phase ? (
            <div className="stack" style={{ gap: "var(--space-lg)" }}>
              {(phaseStandings.data?.tables ?? []).map((table) => (
                <section key={table.group ?? "league"} aria-label={table.group ?? phase.name}>
                  <StandingsTable rows={table.rows} title={table.group ? `${phase.name} · ${table.group}` : phase.name} />
                </section>
              ))}
            </div>
          ) : (
            <div className="card">
              <EmptyState icon={<ChartColumn size={28} />} title="Aún no hay fases" description="Las posiciones se calculan por fase. Crea una fase, elige sus equipos y genera su calendario." action={<Link href={championshipPath(championshipId, "gestionar")} className="btn primary">Configurar fases</Link>} />
            </div>
          )}
        </>
      ) : tab === "scorers" ? (
        <PlayerRanking title="Goleadores" rows={stats.data?.scorers ?? []} empty="Aún no hay goles registrados." value={(row) => row.goals} unit="goles" extra={(row) => (row.assists ? `${row.assists} asist.` : "")} />
      ) : tab === "assists" ? (
        <PlayerRanking title="Asistencias" rows={stats.data?.assisters ?? []} empty="Aún no hay asistencias registradas." value={(row) => row.assists} unit="asist." extra={(row) => (row.goals ? `${row.goals} goles` : "")} />
      ) : tab === "yellow" ? (
        <PlayerRanking
          title="Tarjetas amarillas"
          rows={(stats.data?.cards ?? []).filter((row) => row.yellowCards > 0).sort((a, b) => b.yellowCards - a.yellowCards || a.fullName.localeCompare(b.fullName, "es"))}
          empty="Aún no hay tarjetas amarillas registradas."
          value={(row) => row.yellowCards}
          unit="amarillas"
          extra={() => ""}
        />
      ) : (
        <PlayerRanking
          title="Tarjetas rojas"
          rows={(stats.data?.cards ?? []).filter((row) => row.redCards > 0).sort((a, b) => b.redCards - a.redCards || a.fullName.localeCompare(b.fullName, "es"))}
          empty="Aún no hay tarjetas rojas registradas."
          value={(row) => row.redCards}
          unit="rojas"
          extra={() => ""}
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

const MODE_KEY = "super-torneos:standings-mode";
const MODE_EVENT = "super-torneos:standings-mode-change";
type StandingsMode = "simple" | "detail";

function subscribeMode(notify: () => void) {
  window.addEventListener(MODE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(MODE_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/** Simple or detailed table; the choice is shared by every table and remembered. Default: detail on desktop, simple on phones. */
function useStandingsMode(): [StandingsMode, (mode: StandingsMode) => void] {
  const isMobile = useIsMobile();
  const stored = useSyncExternalStore(
    subscribeMode,
    () => {
      try {
        return window.localStorage.getItem(MODE_KEY);
      } catch {
        return null;
      }
    },
    () => null
  );
  const mode: StandingsMode = stored === "simple" || stored === "detail" ? stored : isMobile ? "simple" : "detail";
  const setMode = (next: StandingsMode) => {
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // The choice just won't be remembered.
    }
    window.dispatchEvent(new Event(MODE_EVENT));
  };
  return [mode, setMode];
}

function ModeToggle({ mode, onChange }: { mode: StandingsMode; onChange: (mode: StandingsMode) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Vista de la tabla">
      {(["simple", "detail"] as const).map((item) => (
        <button key={item} aria-pressed={mode === item} className={mode === item ? "active" : ""} onClick={() => onChange(item)}>
          {item === "simple" ? "Simple" : "Detalle"}
        </button>
      ))}
    </div>
  );
}

export function StandingsTable({ rows, highlightTeamId, title }: { rows: StandingsRowDTO[]; highlightTeamId?: string; title?: string }) {
  const [mode, setMode] = useStandingsMode();
  if (rows.length === 0) {
    return <div className="card"><EmptyState icon={<ChartColumn size={28} />} title="Sin equipos" description="Registra equipos y juega partidos para ver la tabla." /></div>;
  }
  return (
    <div className="flush-list">
      <div className="band band-muted band-small row-between" style={{ minHeight: 48 }}>
        <h2 className="band-small" style={{ padding: 0, background: "none" }}>{title ?? "Clasificación"}</h2>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      {mode === "detail" ? (
        <div className="table-wrap">
          <table className="table standings-detail">
            <thead>
              <tr>
                <th className="sticky-col">Equipo</th>
                <th title="Partidos jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th><th title="Perdidos">P</th>
                <th title="Goles a favor">GF</th><th title="Goles en contra">GC</th><th title="Diferencia de goles">DG</th><th title="Puntos">Pts</th>
                <th className="only-desktop">Forma</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.teamId} className={row.teamId === highlightTeamId ? "highlight" : undefined}>
                  <td className="sticky-col">
                    <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <span className="text-strong" style={{ width: 20, textAlign: "right" }}>{row.position}</span>
                      <Avatar src={row.shieldUrl} name={row.name} size={28} square />
                      <span className="text-strong">{row.name}</span>
                    </span>
                  </td>
                  <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td>
                  <td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td>{signed(row.goalDifference)}</td>
                  <td className="text-strong">{row.points}</td>
                  <td className="only-desktop"><Form form={row.form} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="standings-compact" role="table" aria-label="Clasificación">
          <div className="standings-line head" role="row">
            <span role="columnheader">#</span><span role="columnheader">Equipo</span>
            <span role="columnheader" title="Partidos jugados">PJ</span><span role="columnheader" title="Goles a favor : en contra">G</span><span role="columnheader" title="Puntos">PTS</span>
          </div>
          {rows.map((row) => (
            <div key={row.teamId} role="row" className={`standings-line${row.teamId === highlightTeamId ? " highlight" : ""}`}>
              <span className="standings-pos" role="cell">{row.position}</span>
              <span className="row" role="cell" style={{ gap: 8, minWidth: 0 }}>
                <Avatar src={row.shieldUrl} name={row.name} size={28} square />
                <span className="truncate">{row.name}</span>
              </span>
              <span role="cell">{row.played}</span>
              <span role="cell">{row.goalsFor}:{row.goalsAgainst}</span>
              <span role="cell" className="text-strong" aria-label={`${row.points} puntos`}>{row.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerRanking({ rows, empty, value, unit, extra, showTeam = true, title }: { rows: PlayerStatDTO[]; empty: string; value: (row: PlayerStatDTO) => number; unit: string; extra: (row: PlayerStatDTO) => string; showTeam?: boolean; title?: string }) {
  if (rows.length === 0) {
    return <div className="card"><EmptyState icon={<ChartColumn size={28} />} title="Sin datos" description={empty} /></div>;
  }
  return (
    <div className="flush-list">
      {title && <h2 className="band band-muted band-small">{title} ({rows.length})</h2>}
      {rows.map((row, index) => (
        <div key={row.playerId} className="list-row">
          <span className="text-strong text-secondary" style={{ width: 24 }}>{index + 1}</span>
          <Avatar src={row.photoUrl} name={row.fullName} size={44} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="champ-caption truncate">{[showTeam ? row.teamName : "", extra(row)].filter(Boolean).join(" · ") || "\u00a0"}</div>
            <div className="champ-name truncate">{row.fullName}</div>
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

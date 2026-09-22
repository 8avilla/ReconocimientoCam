"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { StandingsTable } from "@/components/stats/StatsView";
import { EmptyState, ErrorState, Loading } from "@/components/ui";
import { championshipPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import { currentPhase } from "@/lib/rules/currentPhase";
import type { PhaseDTO, PhaseStandingsDTO } from "@/types/api";

/**
 * Table of the phases a team plays in, with its own row highlighted; without `teamId` it is the championship's table
 * (all its phases; knockout ones link to their bracket). `maxRows` trims each table for summaries.
 */
export function TeamStandingsTab({ teamId, championshipId, maxRows, phaseSelector = true }: { teamId?: string; championshipId: string; maxRows?: number; phaseSelector?: boolean }) {
  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${championshipId}/phases`);
  const [choice, setChoice] = useState("");
  const tablePhases = (phases.data?.data ?? []).filter((phase) => !teamId || (phase.type !== "knockout" && phase.teamIds.includes(teamId)))
    .sort((a, b) => a.order - b.order);
  const current = currentPhase(tablePhases);
  const phase = tablePhases.find((item) => item._id === choice) ?? current;
  const standings = useFetch<PhaseStandingsDTO>(phase && phase.type !== "knockout" ? `/phases/${phase._id}/standings` : null);

  if (phases.error) return <ErrorState message={phases.error.message} onRetry={phases.reload} />;
  if (!phases.data) return <Loading />;
  if (!phase) {
    return (
      <div className="card">
        <EmptyState
          icon={<ChartColumn size={28} />}
          title={teamId ? "El equipo no está en ninguna tabla" : "Aún no hay clasificación"}
          description={teamId ? "Agrégalo a una fase de liga o de grupos para ver su clasificación." : "Crea una fase de liga o de grupos, elige sus equipos y juega partidos para ver la tabla."}
          action={<Link href={championshipPath(championshipId, "gestionar")} className="btn primary">Configurar fases</Link>}
        />
      </div>
    );
  }

  // In a groups phase only the team's own group is shown.
  const tables = (standings.data?.tables ?? []).filter((table) => !teamId || table.rows.some((row) => row.teamId === teamId));
  return (
    <div className="stack">
      {phaseSelector && (teamId ? tablePhases.length > 1 : tablePhases.length > 0) && (
        <div className="phase-chips" role="tablist" aria-label="Fase">
          {tablePhases.map((item) => (
            <button key={item._id} role="tab" aria-selected={phase._id === item._id} className={`phase-chip${phase._id === item._id ? " active" : ""}`} onClick={() => setChoice(item._id)}>
              {item.name}
              {current?._id === item._id && <span className="phase-chip-now">Actual</span>}
            </button>
          ))}
        </div>
      )}
      {phase.type === "knockout" ? (
        <div className="card">
          <EmptyState icon={<ChartColumn size={28} />} title="Las eliminatorias no tienen tabla" description="Sus resultados se ven en las llaves de la fase." action={<Link href={`/phases/${phase._id}`} className="btn primary">Ver llaves</Link>} />
        </div>
      ) : standings.error ? (
        <ErrorState message={standings.error.message} onRetry={standings.reload} />
      ) : !standings.data ? (
        <Loading />
      ) : (
        tables.map((table) => (
          <section key={table.group ?? "league"} aria-label={table.group ?? phase.name}>
            <StandingsTable rows={maxRows ? table.rows.slice(0, maxRows) : table.rows} highlightTeamId={teamId} title={table.group ? `${phase.name} · ${table.group}` : phase.name} />
          </section>
        ))
      )}
    </div>
  );
}

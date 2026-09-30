"use client";

import Link from "next/link";
import { Swords, Trash2 } from "lucide-react";
import { FixtureWizard } from "@/components/match/FixtureModal";
import { Button } from "@/components/ui";
import { Matchdays } from "@/components/phase/MatchdaysModal";
import { PhaseForm } from "@/components/phase/PhaseFormModal";
import { PhaseHighlightsManager } from "@/components/phase/PhaseHighlightsManager";
import { PhaseTeams } from "@/components/phase/PhaseTeamsModal";
import { PhaseTiebreakersManager } from "@/components/phase/PhaseTiebreakersManager";
import type { PhaseDTO } from "@/types/api";

export const PHASE_DETAIL_TABS = ["general", "tiebreakers", "highlights", "teams", "matchdays", "fixture", "brackets"] as const;
export type PhaseDetailTab = (typeof PHASE_DETAIL_TABS)[number];

const TAB_LABEL: Record<PhaseDetailTab, string> = {
  general: "General",
  tiebreakers: "Criterio de clasificación",
  highlights: "Resaltar posiciones",
  teams: "Vincular equipos",
  matchdays: "Fechas",
  fixture: "Generar calendario",
  brackets: "Llaves",
};

interface Props {
  championshipId: string;
  phase: PhaseDTO;
  tab: PhaseDetailTab;
  onTab: (tab: PhaseDetailTab) => void;
  /** Leaves this phase's screen (back to the list). */
  onClose: () => void;
  /** Called after any change in any tab, so the counts of the list and this screen refresh. */
  onChanged: () => void;
  /** Deleting is confirmed by the caller; this just triggers it. */
  onDelete: () => void;
}

/** One phase on its own screen: every way to configure it is a tab (general info, teams, fechas, calendar generation...). */
export function PhaseDetail({ championshipId, phase, tab, onTab, onClose, onChanged, onDelete }: Props) {
  const knockout = phase.type === "knockout";
  const tabs = PHASE_DETAIL_TABS.filter((item) => {
    if (item === "fixture") return !knockout;
    if (item === "brackets") return knockout;
    if (item === "tiebreakers" || item === "highlights") return !knockout;
    return true;
  });
  const active = tabs.includes(tab) ? tab : "general";

  return (
    <>
      <div className="tabs-line" role="tablist" aria-label="Configuración de la fase" style={{ marginBottom: "var(--space-lg)" }}>
        {tabs.map((item) => (
          <button key={item} role="tab" aria-selected={active === item} className={`tab-line${active === item ? " active" : ""}`} onClick={() => onTab(item)}>
            {TAB_LABEL[item]}
          </button>
        ))}
      </div>

      <div className="card" style={{ maxWidth: 860 }}>
        {active === "general" && <PhaseForm key={`general:${phase._id}`} championshipId={championshipId} phase={phase} onClose={onClose} onSaved={onChanged} onDelete={onDelete} />}
        {active === "tiebreakers" && !knockout && <PhaseTiebreakersManager key={`tiebreakers:${phase._id}`} phase={phase} onClose={onClose} onSaved={onChanged} />}
        {active === "highlights" && !knockout && <PhaseHighlightsManager key={`highlights:${phase._id}`} phase={phase} onClose={onClose} onSaved={onChanged} />}
        {active === "teams" && <PhaseTeams key={`teams:${phase._id}:${phase.teamCount}`} phase={phase} onClose={onClose} onSaved={onChanged} />}
        {active === "matchdays" && <Matchdays key={`matchdays:${phase._id}`} phase={phase} onClose={onClose} onChanged={onChanged} />}
        {active === "fixture" && !knockout && (
          <FixtureWizard
            key={`fixture:${phase._id}`}
            championshipId={championshipId}
            phases={[phase]}
            initialPhaseId={phase._id}
            onClose={onClose}
            onCreated={() => {
              onChanged();
              onTab("matchdays");
            }}
          />
        )}
        {active === "brackets" && knockout && (
          <div className="stack" style={{ alignItems: "center", textAlign: "center", padding: "var(--space-xl) 0" }}>
            <Swords size={32} color="var(--color-text-disabled)" aria-hidden />
            <p className="text-secondary">Las rondas, cruces y resultados de la eliminatoria se administran en su propia pantalla.</p>
            <Link href={`/phases/${phase._id}`} className="btn primary">Ir a las llaves</Link>
          </div>
        )}
      </div>
      {!(active === "general") && (
        <div style={{ marginTop: "var(--space-lg)" }}>
          <Button variant="ghost" size="small" icon={<Trash2 size={16} />} onClick={onDelete}>Eliminar fase</Button>
        </div>
      )}
    </>
  );
}

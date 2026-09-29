"use client";

import { useState } from "react";
import Link from "next/link";
import { Swords } from "lucide-react";
import { FixtureWizard } from "@/components/match/FixtureModal";
import { Modal } from "@/components/ui";
import { Matchdays } from "@/components/phase/MatchdaysModal";
import { PhaseForm } from "@/components/phase/PhaseFormModal";
import { PhaseHighlightsManager } from "@/components/phase/PhaseHighlightsManager";
import { PhaseTeams } from "@/components/phase/PhaseTeamsModal";
import { PhaseTiebreakersManager } from "@/components/phase/PhaseTiebreakersManager";
import type { PhaseDTO } from "@/types/api";

export type PhaseDetailTab = "general" | "tiebreakers" | "highlights" | "teams" | "matchdays" | "fixture" | "brackets";

const TABS: { id: PhaseDetailTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "tiebreakers", label: "Criterio de clasificación" },
  { id: "highlights", label: "Resaltar posiciones" },
  { id: "teams", label: "Vincular equipos" },
  { id: "matchdays", label: "Fechas" },
  { id: "fixture", label: "Generar calendario" },
  { id: "brackets", label: "Llaves" },
];

interface Props {
  open: boolean;
  championshipId: string;
  phase: PhaseDTO;
  /** Which tab is active when the popup opens. */
  initialTab?: PhaseDetailTab;
  onClose: () => void;
  /** Called after any change in any tab, so the list behind it can refresh its counts. */
  onChanged: () => void;
  /** Deleting the phase is handled by the caller (it owns the confirm dialog); this just triggers it. */
  onDelete: () => void;
}

/** One phase, every way to configure it, behind a single popup: clicking a phase opens this instead of
 * four separate dialogs — general info, teams, fechas and calendar generation are just tabs of it. */
export function PhaseDetailModal({ open, championshipId, phase, initialTab = "general", onClose, onChanged, onDelete }: Props) {
  // The caller only ever mounts this when opening it fresh (see PhasesManager), so the initial tab is
  // always the one the trigger asked for — no effect needed to keep it in sync afterwards.
  const [tab, setTab] = useState<PhaseDetailTab>(initialTab);

  const knockout = phase.type === "knockout";
  const tabs = TABS.filter((item) => {
    if (item.id === "fixture") return !knockout;
    if (item.id === "brackets") return knockout;
    if (item.id === "tiebreakers") return !knockout;
    if (item.id === "highlights") return !knockout;
    return true;
  });

  return (
    <Modal open={open} title={phase.name} onClose={onClose} wide>
      <div className="tabs-line" role="tablist" aria-label="Configuración de la fase" style={{ marginBottom: "var(--space-lg)" }}>
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "general" && <PhaseForm key={`general:${phase._id}`} championshipId={championshipId} phase={phase} onClose={onClose} onSaved={onChanged} onDelete={onDelete} />}
      {tab === "tiebreakers" && !knockout && <PhaseTiebreakersManager key={`tiebreakers:${phase._id}`} phase={phase} onClose={onClose} onSaved={onChanged} />}
      {tab === "highlights" && !knockout && <PhaseHighlightsManager key={`highlights:${phase._id}`} phase={phase} onClose={onClose} onSaved={onChanged} />}
      {tab === "teams" && <PhaseTeams key={`teams:${phase._id}`} phase={phase} onClose={onClose} onSaved={onChanged} />}
      {tab === "matchdays" && <Matchdays key={`matchdays:${phase._id}`} phase={phase} onClose={onClose} onChanged={onChanged} />}
      {tab === "fixture" && !knockout && (
        <FixtureWizard key={`fixture:${phase._id}`} championshipId={championshipId} phases={[phase]} initialPhaseId={phase._id} onClose={onClose} onCreated={onChanged} />
      )}
      {tab === "brackets" && knockout && (
        <div className="stack" style={{ alignItems: "center", textAlign: "center", padding: "var(--space-xl) 0" }}>
          <Swords size={32} color="var(--color-text-disabled)" aria-hidden />
          <p className="text-secondary">Las rondas, cruces y resultados de la eliminatoria se administran en su propia pantalla.</p>
          <Link href={`/phases/${phase._id}`} className="btn primary">Ir a las llaves</Link>
        </div>
      )}
    </Modal>
  );
}

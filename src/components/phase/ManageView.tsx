"use client";

import Link from "next/link";
import { ChevronRight, Gavel, Users } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { RefereesManager } from "@/components/manage/RefereesManager";
import { RulesSummary } from "@/components/manage/RulesSummary";
import { ShareLink } from "@/components/manage/ShareLink";
import { VenuesManager } from "@/components/manage/VenuesManager";
import { PhasesManager } from "@/components/phase/PhasesManager";
import { PageHeader } from "@/components/ui";
import { useStoredState } from "@/lib/client/useStoredState";
import { championshipPath } from "@/lib/paths";

const TABS = [
  { id: "phases", label: "Fases" },
  { id: "referees", label: "Árbitros" },
  { id: "venues", label: "Sitios" },
  { id: "rules", label: "Reglas" },
  { id: "share", label: "Compartir" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Organizer's workspace for one championship: phases, referees, venues, rules and the link to share it. */
export function ManageView({ championshipId }: { championshipId: string }) {
  const { current } = useChampionship();
  const [tab, setTab] = useStoredState<Tab>("super-torneos:manage:tab", "phases", (value) => TABS.some((item) => item.id === value));

  return (
    <>
      <PageHeader title="Gestionar" description={current ? `${current.name} · Temporada ${current.season}` : undefined} />

      <div className="tabs-line" role="tablist" aria-label="Qué gestionar">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "phases" && <PhasesManager championshipId={championshipId} />}
      {tab === "referees" && <RefereesManager championshipId={championshipId} />}
      {tab === "venues" && <VenuesManager championshipId={championshipId} />}
      {tab === "rules" && <RulesSummary />}
      {tab === "share" && <ShareLink championshipId={championshipId} name={current?.name ?? "el campeonato"} />}

      <div className="flush-list" style={{ marginTop: "var(--space-2xl)" }}>
        <h2 className="band band-muted band-small">Más herramientas</h2>
        <Link href={championshipPath(championshipId, "jugadores")} className="list-row">
          <span className="attention-icon today"><Users size={20} aria-hidden /></span>
          <div className="grow"><div className="text-strong">Jugadores</div><div className="text-secondary text-small">Registro, fotos y rostros de los jugadores.</div></div>
          <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
        </Link>
        <Link href={championshipPath(championshipId, "sanciones")} className="list-row">
          <span className="attention-icon todo"><Gavel size={20} aria-hidden /></span>
          <div className="grow"><div className="text-strong">Sanciones y multas</div><div className="text-secondary text-small">Suspensiones, multas por tarjetas y sus pagos.</div></div>
          <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
        </Link>
      </div>
    </>
  );
}

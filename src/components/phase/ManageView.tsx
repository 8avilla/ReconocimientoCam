"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, ChartColumn, Gavel, Globe, Lock, MapPin, Pencil, Share2, Shield, Trophy, Users, Whistle } from "lucide-react";
import { ChampionshipFormModal } from "@/components/championship/ChampionshipFormModal";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { OrganizersManager } from "@/components/manage/OrganizersManager";
import { RefereesManager } from "@/components/manage/RefereesManager";
import { RulesSummary } from "@/components/manage/RulesSummary";
import { ShareLink } from "@/components/manage/ShareLink";
import { VenuesManager } from "@/components/manage/VenuesManager";
import { PhasesManager } from "@/components/phase/PhasesManager";
import { Badge, Button, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { championshipPath } from "@/lib/paths";
import type { PhaseDTO, RefereeDTO, VenueDTO } from "@/types/api";

type Tab = "phases" | "referees" | "venues" | "organizers" | "rules" | "share";

/** Organizer's workspace for one championship: phases, referees, venues, rules and the link to share it.
 * The only place to edit the championship itself (name, dates, visibility, fees, rules...) — see the
 * "Editar campeonato" button below, which is the single entry point to that form across the app. */
export function ManageView({ championshipId }: { championshipId: string }) {
  const { current, reload } = useChampionship();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useStoredState<Tab>(`super-torneos:manage:tab:${championshipId}`, "phases", (value) =>
    ["phases", "referees", "venues", "organizers", "rules", "share"].includes(value)
  );

  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${championshipId}/phases`);
  const referees = useFetch<{ data: RefereeDTO[] }>(`/referees?championshipId=${championshipId}`);
  const venues = useFetch<{ data: VenueDTO[] }>(`/venues?championshipId=${championshipId}`);

  const phaseList = phases.data?.data ?? [];
  const refereeList = referees.data?.data ?? [];
  const venueList = venues.data?.data ?? [];
  const organizersCount = current?.organizerUserIds?.length ?? 1;

  const totalMatches = phaseList.reduce((acc, p) => acc + (p.matches?.total ?? 0), 0);
  const finishedMatches = phaseList.reduce((acc, p) => acc + (p.matches?.finished ?? 0), 0);
  const progressPercent = totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "phases", label: "Fases", icon: <Trophy size={16} />, count: phaseList.length },
    { id: "referees", label: "Árbitros", icon: <Whistle size={16} />, count: refereeList.length },
    { id: "venues", label: "Sitios", icon: <MapPin size={16} />, count: venueList.length },
    { id: "organizers", label: "Organizadores", icon: <Users size={16} />, count: organizersCount },
    { id: "rules", label: "Reglas", icon: <Award size={16} /> },
    { id: "share", label: "Compartir", icon: <Share2 size={16} /> },
  ];

  return (
    <>
      <PageHeader title="Gestionar" description={current ? `${current.name} · Temporada ${current.season}` : undefined} />

      {/* Tournament Control Hub Header Card */}
      <section className="manage-hub-card" aria-label="Centro de control del torneo">
        <div className="manage-hub-header">
          <div>
            <div className="manage-hub-title">
              <Trophy size={24} style={{ color: "var(--color-primary)" }} />
              {current?.name ?? "Campeonato"}
            </div>
            <div className="row-wrap" style={{ gap: 8, marginTop: 4 }}>
              <span className="text-secondary">Temporada {current?.season ?? "2026"}</span>
              {current?.visibility === "public" ? (
                <Badge tone="success" icon={<Globe size={12} />}>Público</Badge>
              ) : (
                <Badge tone="neutral" icon={<Lock size={12} />}>Privado</Badge>
              )}
            </div>
          </div>

          <div className="row-wrap" style={{ gap: "var(--space-xs)" }}>
            <Button size="small" icon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>Editar campeonato</Button>
            <Link href={championshipPath(championshipId, "clasificacion")} className="btn secondary" style={{ fontSize: 13 }}>
              <ChartColumn size={16} /> Ver Clasificación
            </Link>
          </div>

        </div>

        {/* Global Progress Bar */}
        {totalMatches > 0 && (
          <div className="manage-progress-container">
            <div className="manage-progress-info">
              <span>Avance Global del Torneo</span>
              <span style={{ color: "var(--color-primary-dark)" }}>{finishedMatches} de {totalMatches} partidos ({progressPercent}%)</span>
            </div>
            <div className="manage-progress-track">
              <div className="manage-progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* Enhanced Tab Navigation with Badges & Icons */}
      <div className="tabs-line" role="tablist" aria-label="Qué gestionar">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`tab-line${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.count != null && (
              <span className="filter-chip-badge" style={{ marginLeft: 2 }}>{item.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "phases" && <PhasesManager championshipId={championshipId} />}
      {tab === "referees" && <RefereesManager championshipId={championshipId} />}
      {tab === "venues" && <VenuesManager championshipId={championshipId} />}
      {tab === "organizers" && <OrganizersManager championshipId={championshipId} />}
      {tab === "rules" && <RulesSummary />}
      {tab === "share" && <ShareLink championshipId={championshipId} name={current?.name ?? "el campeonato"} />}

      {/* Quick Tools Grid */}
      <div style={{ marginTop: "var(--space-2xl)" }}>
        <h2 className="band band-muted band-small">Más herramientas de administración</h2>
        <div className="tools-grid">
          <Link href={championshipPath(championshipId, "jugadores")} className="tool-card">
            <div className="tool-card-icon" style={{ background: "#dbeafe", color: "#1d4ed8" }}>
              <Users size={20} />
            </div>
            <div>
              <div className="tool-card-title">Jugadores y Biometría</div>
              <div className="tool-card-desc">Registro, fotos y enrolamiento facial.</div>
            </div>
          </Link>

          <Link href={championshipPath(championshipId, "sanciones")} className="tool-card">
            <div className="tool-card-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
              <Gavel size={20} />
            </div>
            <div>
              <div className="tool-card-title">Sanciones y Multas</div>
              <div className="tool-card-desc">Control de amarillas, rojas y suspensiones.</div>
            </div>
          </Link>

          <Link href={championshipPath(championshipId, "equipos")} className="tool-card">
            <div className="tool-card-icon" style={{ background: "#dcfce7", color: "#15803d" }}>
              <Shield size={20} />
            </div>
            <div>
              <div className="tool-card-title">Equipos e Inscripciones</div>
              <div className="tool-card-desc">Gestión de clubes y cuotas de torneo.</div>
            </div>
          </Link>

          <Link href={championshipPath(championshipId, "clasificacion")} className="tool-card">
            <div className="tool-card-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
              <ChartColumn size={20} />
            </div>
            <div>
              <div className="tool-card-title">Tablas y Resultados</div>
              <div className="tool-card-desc">Posiciones de liga y cruces de eliminatoria.</div>
            </div>
          </Link>
        </div>
      </div>

      {current && (
        <ChampionshipFormModal
          open={editOpen}
          championship={current}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            reload();
          }}
        />
      )}
    </>
  );
}


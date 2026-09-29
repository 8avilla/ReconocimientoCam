"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, ChartColumn, ChevronRight, Globe, Lock, MapPin, Pencil, Share2, Trophy, Users, Whistle } from "lucide-react";
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
import { championshipPath } from "@/lib/paths";
import type { PhaseDTO, RefereeDTO, VenueDTO } from "@/types/api";

type Tab = "phases" | "referees" | "venues" | "organizers" | "rules" | "share";
const TABS: Tab[] = ["phases", "referees", "venues", "organizers", "rules", "share"];

/** Organizer's workspace for one championship: phases, referees, venues, rules and the link to share it.
 * The only place to edit the championship itself (name, dates, visibility, fees, rules...) — see the
 * "Editar torneo" button below, which is the single entry point to that form across the app.
 * A vertical "Configuración" list, not tabs: each item is its own destination (`?s=phases`, shareable and
 * back-button friendly), reached from — and returned to — the same hub screen. */
export function ManageView({ championshipId }: { championshipId: string }) {
  const { current, reload } = useChampionship();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const requested = searchParams.get("s");
  const tab: Tab | null = TABS.find((item) => item === requested) ?? null;
  const openSection = (id: Tab) => router.push(championshipPath(championshipId, "gestionar", `?s=${id}`));

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

  const items: { id: Tab; label: string; description: string; icon: React.ReactNode; count?: number }[] = [
    { id: "phases", label: "Fases", description: "Configura las etapas del torneo", icon: <Trophy size={20} />, count: phaseList.length },
    { id: "referees", label: "Árbitros", description: "Personas que dirigen los partidos", icon: <Whistle size={20} />, count: refereeList.length },
    { id: "venues", label: "Sitios", description: "Canchas y lugares de los partidos", icon: <MapPin size={20} />, count: venueList.length },
    { id: "organizers", label: "Organizadores", description: "Personas que administran el torneo", icon: <Users size={20} />, count: organizersCount },
    { id: "rules", label: "Reglas", description: "Puntos, plantillas y sanciones", icon: <Award size={20} /> },
    { id: "share", label: "Compartir", description: "Enlace público del torneo", icon: <Share2 size={20} /> },
  ];
  const active = items.find((item) => item.id === tab);

  if (active) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Gestionar", href: championshipPath(championshipId, "gestionar") }, { label: active.label }]} title={active.label} />
        {active.id === "phases" && <PhasesManager championshipId={championshipId} />}
        {active.id === "referees" && <RefereesManager championshipId={championshipId} />}
        {active.id === "venues" && <VenuesManager championshipId={championshipId} />}
        {active.id === "organizers" && <OrganizersManager championshipId={championshipId} />}
        {active.id === "rules" && <RulesSummary />}
        {active.id === "share" && <ShareLink championshipId={championshipId} name={current?.name ?? "el torneo"} />}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Gestionar" description={current ? `${current.name} · Temporada ${current.season}` : undefined} />

      {/* Tournament Control Hub Header Card */}
      <section className="manage-hub-card" aria-label="Centro de control del torneo">
        <div className="manage-hub-header">
          <div>
            <div className="manage-hub-title">
              <Trophy size={24} style={{ color: "var(--color-primary)" }} />
              {current?.name ?? "Torneo"}
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
            <Button size="small" icon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>Editar torneo</Button>
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

      <h2 className="band band-muted band-small">Configuración</h2>
      <div className="manage-config-list">
        {items.map((item) => (
          <button key={item.id} className="manage-config-row" onClick={() => openSection(item.id)}>
            <span className="manage-config-icon">{item.icon}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="text-strong">{item.label}</span>
              <span className="text-secondary text-small" style={{ display: "block" }}>{item.description}</span>
            </span>
            {item.count != null && <span className="filter-chip-badge">{item.count}</span>}
            <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
          </button>
        ))}
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


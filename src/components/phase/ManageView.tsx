"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Award, ChevronRight, DollarSign, Globe, Link2, Lock, MapPin, Settings, Trophy, Users, Whistle } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { FinancesManager } from "@/components/manage/FinancesManager";
import { GeneralInfoManager } from "@/components/manage/GeneralInfoManager";
import { LinkVisibilityManager } from "@/components/manage/LinkVisibilityManager";
import { OrganizersManager } from "@/components/manage/OrganizersManager";
import { RefereesManager } from "@/components/manage/RefereesManager";
import { RulesManager } from "@/components/manage/RulesManager";
import { ShareLink } from "@/components/manage/ShareLink";
import { VenuesManager } from "@/components/manage/VenuesManager";
import { PhasesManager } from "@/components/phase/PhasesManager";
import { Badge, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import { championshipPath } from "@/lib/paths";
import type { PhaseDTO, RefereeDTO, VenueDTO } from "@/types/api";

type Tab = "general" | "link" | "phases" | "referees" | "venues" | "organizers" | "finances" | "rules";
const TABS: Tab[] = ["general", "link", "phases", "referees", "venues", "organizers", "finances", "rules"];

/** Organizer's workspace for one championship: everything that used to be split between these tabs and
 * the separate "Editar torneo" modal now lives in one "Configuración" list — a vertical list of
 * destinations, not tabs: each item is its own screen (`?s=general`, shareable and back-button
 * friendly), reached from — and returned to — the same hub screen. */
export function ManageView({ championshipId }: { championshipId: string }) {
  const { current } = useChampionship();
  const router = useRouter();
  const searchParams = useSearchParams();
  // "Compartir" used to be its own section; it now lives with the link and visibility, so old addresses still land there.
  const asked = searchParams.get("s");
  const requested = asked === "share" ? "link" : asked;
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
    { id: "general", label: "Información general", description: "Nombre, logo, temporada y fechas", icon: <Settings size={20} /> },
    { id: "link", label: "Enlace, visibilidad y compartir", description: "Dirección pública, quién puede verlo y cómo compartirlo", icon: <Link2 size={20} /> },
    { id: "phases", label: "Fases", description: "Configura las etapas del torneo", icon: <Trophy size={20} />, count: phaseList.length },
    { id: "referees", label: "Árbitros", description: "Personas que dirigen los partidos", icon: <Whistle size={20} />, count: refereeList.length },
    { id: "venues", label: "Sitios", description: "Canchas y lugares de los partidos", icon: <MapPin size={20} />, count: venueList.length },
    { id: "organizers", label: "Organizadores", description: "Personas que administran el torneo", icon: <Users size={20} />, count: organizersCount },
    { id: "finances", label: "Finanzas y multas", description: "Cuota de inscripción y multas por tarjeta", icon: <DollarSign size={20} /> },
    { id: "rules", label: "Reglas", description: "Puntos, plantillas y sanciones", icon: <Award size={20} /> },
  ];
  const active = items.find((item) => item.id === tab);

  if (active) {
    // A phase opened from the list has its own screen: the crumbs lead back to the list and the title is the phase.
    const openPhase = active.id === "phases" ? phaseList.find((item) => item._id === (searchParams.get("phase") ?? "")) : undefined;
    const section = { label: "Configuración", href: championshipPath(championshipId, "gestionar") };
    return (
      <>
        <PageHeader
          breadcrumb={openPhase ? [section, { label: active.label, href: championshipPath(championshipId, "gestionar", "?s=phases") }, { label: openPhase.name }] : [section, { label: active.label }]}
          title={openPhase?.name ?? active.label}
        />
        {active.id === "general" && <GeneralInfoManager championshipId={championshipId} />}
        {active.id === "link" && (
          <div className="stack" style={{ gap: "var(--space-xl)" }}>
            <LinkVisibilityManager championshipId={championshipId} />
            <ShareLink championshipId={championshipId} name={current?.name ?? "el torneo"} />
          </div>
        )}
        {active.id === "phases" && <PhasesManager championshipId={championshipId} />}
        {active.id === "referees" && <RefereesManager championshipId={championshipId} />}
        {active.id === "venues" && <VenuesManager championshipId={championshipId} />}
        {active.id === "organizers" && <OrganizersManager championshipId={championshipId} />}
        {active.id === "finances" && <FinancesManager championshipId={championshipId} />}
        {active.id === "rules" && <RulesManager championshipId={championshipId} />}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Configuración del torneo" description={current ? `${current.name} · Temporada ${current.season}` : undefined} />

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
    </>
  );
}

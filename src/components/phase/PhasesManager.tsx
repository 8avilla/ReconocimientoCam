"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarPlus, ChartColumn, Layers, Pencil, Plus, Swords, Trash2, Users } from "lucide-react";
import { FixtureModal } from "@/components/match/FixtureModal";
import { PhaseFormModal } from "@/components/phase/PhaseFormModal";
import { MatchdaysModal } from "@/components/phase/MatchdaysModal";
import { PhaseTeamsModal } from "@/components/phase/PhaseTeamsModal";
import { ActionMenu, type MenuAction, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Fab, Loading, useToast } from "@/components/ui";
import { championshipPath } from "@/lib/paths";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { LEGS_LABEL, PHASE_TYPE_LABEL } from "@/lib/labels";
import type { ChampionshipDTO, PhaseDTO } from "@/types/api";

type Dialog = { kind: "form" | "teams" | "fixture" | "delete" | "matchdays"; phase: PhaseDTO | null } | null;

/** Championship configuration: the phases it is played in (all-play-all, groups...). */
export function PhasesManager({ championshipId }: { championshipId: string }) {
  const toast = useToast();
  const championship = useFetch<ChampionshipDTO>(`/championships/${championshipId}`);
  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${championshipId}/phases`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);

  const error = championship.error ?? phases.error;
  if (error) return <ErrorState message={error.message} onRetry={() => { championship.reload(); phases.reload(); }} />;
  if (!championship.data || !phases.data) return <Loading />;
  const list = phases.data.data;
  const close = () => setDialog(null);
  const saved = () => {
    close();
    phases.reload();
  };

  async function confirmDelete() {
    if (dialog?.kind !== "delete" || !dialog.phase) return;
    setDeleting(true);
    try {
      await http(`/phases/${dialog.phase._id}`, { method: "DELETE" });
      toast.success("Fase eliminada");
      saved();
    } catch (err) {
      toast.error(errorMessage(err));
      close();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: "var(--space-lg)" }}>
        <p className="text-secondary">Cómo se juega el campeonato: liga, grupos o eliminatoria, en el orden en que se juegan.</p>
        <Button icon={<Plus size={18} />} className="only-desktop" onClick={() => setDialog({ kind: "form", phase: null })}>Nueva fase</Button>
      </div>
      <Fab label="Fases" actions={[{ label: "Nueva fase", icon: <Plus size={20} />, onClick: () => setDialog({ kind: "form", phase: null }) }]} />

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Layers size={28} />}
            title="Este campeonato aún no tiene fases"
            description="Crea las fases en el orden en que se juegan, por ejemplo: una fase de grupos y después una liga final. Tú eliges qué equipos participan en cada una."
            action={<Button onClick={() => setDialog({ kind: "form", phase: null })}>Crear la primera fase</Button>}
          />
        </div>
      ) : (
        <div className="stack" aria-label="Fases del campeonato">
          {list.map((phase) => {
            const knockout = phase.type === "knockout";
            const needsTeams = phase.teamCount < 2;
            const noCalendar = phase.matches.total === 0;
            const actions: Record<"teams" | "matchdays" | "fixture" | "table" | "brackets", MenuAction> = {
              teams: { label: "Equipos", icon: <Users size={18} />, onClick: () => setDialog({ kind: "teams", phase }) },
              matchdays: { label: "Fechas", icon: <CalendarDays size={18} />, onClick: () => setDialog({ kind: "matchdays", phase }) },
              fixture: { label: "Generar calendario", icon: <CalendarPlus size={18} />, disabled: needsTeams, onClick: () => setDialog({ kind: "fixture", phase }) },
              table: { label: "Tabla", icon: <ChartColumn size={18} />, href: championshipPath(championshipId, "clasificacion", `?phase=${phase._id}`) },
              brackets: { label: "Llaves", icon: <Swords size={18} />, href: `/phases/${phase._id}` },
            };
            const primary = knockout ? actions.brackets : needsTeams ? actions.teams : noCalendar ? actions.fixture : actions.table;
            const others = [actions.teams, actions.matchdays, ...(knockout ? [] : [actions.fixture, actions.table])].filter((item) => item !== primary);
            const menu = [
              ...others,
              { label: "Editar fase", icon: <Pencil size={18} />, onClick: () => setDialog({ kind: "form", phase }) },
              { label: "Eliminar fase", icon: <Trash2 size={18} />, danger: true, onClick: () => setDialog({ kind: "delete", phase }) },
            ];

            const matchProgressPercent = phase.matches.total > 0 ? Math.round((phase.matches.finished / phase.matches.total) * 100) : 0;

            return (
              <div key={phase._id} className="phase-stage-card">
                <div className="phase-stage-header">
                  <div className="row grow" style={{ gap: "var(--space-md)" }}>
                    <span className="phase-order-badge" aria-hidden>{phase.order}</span>
                    <div className="grow">
                      <h3 style={{ fontSize: 18 }}>{phase.name}</h3>
                      <p className="text-secondary text-small">
                        {PHASE_TYPE_LABEL[phase.type]}{phase.type === "groups" && ` (${phase.groupCount} grupos)`}{!knockout && ` · ${LEGS_LABEL[phase.legs]}`}
                        {` · ${phase.teamCount} equipos`}
                      </p>
                    </div>
                  </div>
                  <ActionMenu label={`Más acciones de ${phase.name}`} actions={menu} />
                </div>

                {!knockout && phase.matches.total > 0 && (
                  <div style={{ background: "var(--color-background)", padding: "var(--space-sm) var(--space-md)", borderRadius: "var(--radius-md)" }}>
                    <div className="row-between text-small" style={{ fontWeight: 600, marginBottom: 4 }}>
                      <span>Avance de partidos</span>
                      <span>{phase.matches.finished} / {phase.matches.total} partidos ({matchProgressPercent}%)</span>
                    </div>
                    <div className="manage-progress-track">
                      <div className="manage-progress-bar" style={{ width: `${matchProgressPercent}%` }} />
                    </div>
                  </div>
                )}

                {needsTeams && !knockout && (
                  <Badge tone="warning">Elige al menos 2 equipos para generar el calendario</Badge>
                )}

                <div className="row-between" style={{ gap: "var(--space-md)", flexWrap: "wrap", marginTop: 4 }}>
                  <div className="text-secondary text-small">
                    {knockout
                      ? phase.rounds.length === 0 ? "Sin rondas configuradas" : `${phase.rounds.length} rondas · ${phase.ties?.decided ?? 0}/${phase.ties?.total ?? 0} cruces definidos`
                      : `${phase.matchdayCount} fechas creadas`}
                  </div>

                  {primary.href ? (
                    <Link href={primary.href} className="btn primary">{primary.icon}{primary.label}</Link>
                  ) : (
                    <Button icon={primary.icon} disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      <PhaseFormModal open={dialog?.kind === "form"} championshipId={championshipId} phase={dialog?.kind === "form" ? dialog.phase : null} onClose={close} onSaved={saved} />
      {dialog?.kind === "matchdays" && dialog.phase && <MatchdaysModal open phase={dialog.phase} onClose={close} onChanged={phases.reload} />}
      {dialog?.kind === "teams" && dialog.phase && <PhaseTeamsModal open phase={dialog.phase} onClose={close} onSaved={saved} />}
      {dialog?.kind === "fixture" && dialog.phase && (
        <FixtureModal open championshipId={championshipId} phases={list} initialPhaseId={dialog.phase._id} onClose={close} onCreated={saved} />
      )}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title="Eliminar fase"
        message={`¿Eliminar "${dialog?.phase?.name}"? Solo es posible si aún no tiene partidos.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={close}
      />
    </>
  );
}

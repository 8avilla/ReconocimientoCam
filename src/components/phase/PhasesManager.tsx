"use client";

import { useState } from "react";
import { ChevronRight, Layers, Plus } from "lucide-react";
import { PhaseDetailModal, type PhaseDetailTab } from "@/components/phase/PhaseDetailModal";
import { PhaseFormModal } from "@/components/phase/PhaseFormModal";
import { Button, ConfirmDialog, EmptyState, ErrorState, Fab, Loading, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { ChampionshipDTO, PhaseDTO } from "@/types/api";

type Dialog = { kind: "new" | "delete"; phase: PhaseDTO | null } | { kind: "detail"; phase: PhaseDTO; initialTab: PhaseDetailTab } | null;

/** Championship configuration: the phases it is played in (all-play-all, groups...), in the order they
 * are played. Just a plain list of names — clicking one opens everything about it (general info, teams,
 * fechas, calendar generation) in a single tabbed popup. */
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
        <p className="text-secondary">Cómo se juega el torneo: liga, grupos o eliminatoria, en el orden en que se juegan.</p>
        <Button icon={<Plus size={18} />} className="only-desktop" onClick={() => setDialog({ kind: "new", phase: null })}>Nueva fase</Button>
      </div>
      <Fab label="Fases" actions={[{ label: "Nueva fase", icon: <Plus size={20} />, onClick: () => setDialog({ kind: "new", phase: null }) }]} />

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Layers size={28} />}
            title="Este torneo aún no tiene fases"
            description="Crea las fases en el orden en que se juegan, por ejemplo: una fase de grupos y después una liga final. Tú eliges qué equipos participan en cada una."
            action={<Button onClick={() => setDialog({ kind: "new", phase: null })}>Crear la primera fase</Button>}
          />
        </div>
      ) : (
        <div className="manage-config-list" aria-label="Fases del torneo">
          {list.map((phase) => (
            <button key={phase._id} className="manage-config-row" onClick={() => setDialog({ kind: "detail", phase, initialTab: "general" })}>
              <span className="phase-order-badge" aria-hidden style={{ flexShrink: 0 }}>{phase.order}</span>
              <span className="grow text-strong" style={{ minWidth: 0 }}>{phase.name}</span>
              <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
            </button>
          ))}
        </div>
      )}

      <PhaseFormModal open={dialog?.kind === "new"} championshipId={championshipId} phase={null} onClose={close} onSaved={saved} />
      {dialog?.kind === "detail" && (
        <PhaseDetailModal
          open
          championshipId={championshipId}
          phase={dialog.phase}
          initialTab={dialog.initialTab}
          onClose={close}
          onChanged={saved}
          onDelete={() => setDialog({ kind: "delete", phase: dialog.phase })}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title="Eliminar fase"
        message={
          dialog?.phase && (dialog.phase.matches.total > 0 || dialog.phase.teamCount > 0)
            ? `"${dialog.phase.name}" tiene ${dialog.phase.matches.total} partido(s) y ${dialog.phase.teamCount} equipo(s) vinculados. Al eliminarla se borrarán también esos partidos con sus eventos, convocatorias y asistencia. Los equipos no se eliminan, solo quedan sin esta fase. Esta acción no se puede deshacer.`
            : `¿Eliminar "${dialog?.phase?.name}"? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar de todas formas"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={close}
      />
    </>
  );
}

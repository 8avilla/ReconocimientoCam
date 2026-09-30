"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Layers, Plus } from "lucide-react";
import { PhaseDetail, PHASE_DETAIL_TABS, type PhaseDetailTab } from "@/components/phase/PhaseDetail";
import { PhaseFormModal } from "@/components/phase/PhaseFormModal";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Fab, Loading, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { noteNavigation } from "@/lib/client/useBackButtonClose";
import { useFetch } from "@/lib/client/useFetch";
import { PHASE_TYPE_LABEL } from "@/lib/labels";
import type { ChampionshipDTO, PhaseDTO } from "@/types/api";

/** Championship configuration: the phases it is played in (all-play-all, groups...), in the order they
 * are played. A list with what each one still needs; opening one shows its own screen (`?phase=<id>&tab=...`,
 * shareable and back-button friendly) with general info, teams, fechas and calendar generation as tabs.
 * The setup checklist links here with `go=new|teams|fixture`: it lands directly on what that step needs. */
export function PhasesManager({ championshipId }: { championshipId: string }) {
  const toast = useToast();
  const championship = useFetch<ChampionshipDTO>(`/championships/${championshipId}`);
  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${championshipId}/phases`);
  const [dialog, setDialog] = useState<"new" | "delete" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const routerBase = useRouter();
  // Every navigation here can coincide with a dialog closing: tell the back-button handling so it keeps the new address.
  const router = useMemo(
    () => ({
      push: (url: string, options?: { scroll?: boolean }) => { noteNavigation(); routerBase.push(url, options); },
      replace: (url: string, options?: { scroll?: boolean }) => { noteNavigation(); routerBase.replace(url, options); },
    }),
    [routerBase]
  );
  const pathname = usePathname();
  const params = useSearchParams();
  const go = params.get("go");
  const base = `${pathname}?s=phases`;

  const list = phases.data?.data ?? [];
  const table = list.filter((item) => item.type !== "knockout");
  const goPhase = go === "teams" ? table.find((item) => item.teamCount < 2) : go === "fixture" ? table.find((item) => item.teamCount >= 2 && item.matches.total === 0) : undefined;
  const requestedTab = params.get("tab");
  const tab: PhaseDetailTab | null = PHASE_DETAIL_TABS.find((item) => item === requestedTab) ?? (go === "teams" ? "teams" : go === "fixture" ? "fixture" : null);
  const activePhase = list.find((item) => item._id === (params.get("phase") ?? goPhase?._id));
  // `go=new` opens the creation form once; it is dropped from the address as soon as the form closes.
  const [newConsumed, setNewConsumed] = useState(false);
  const creating = dialog === "new" || (go === "new" && !newConsumed && Boolean(phases.data));

  // A `go=` link lands on the phase's own address (with its phase and tab) so crumbs, title and back button match it.
  const phasesLoaded = Boolean(phases.data);
  const goTarget = goPhase?._id;
  useEffect(() => {
    if (!phasesLoaded || (go !== "teams" && go !== "fixture")) return;
    router.replace(goTarget ? `${base}&phase=${goTarget}&tab=${go}` : base, { scroll: false });
  }, [phasesLoaded, go, goTarget, base, router]);

  const error = championship.error ?? phases.error;
  if (error) return <ErrorState message={error.message} onRetry={() => { championship.reload(); phases.reload(); }} />;
  if (!championship.data || !phases.data) return <Loading />;

  const openPhase = (id: string, nextTab?: PhaseDetailTab) => router.push(`${base}&phase=${id}${nextTab ? `&tab=${nextTab}` : ""}`, { scroll: false });
  const backToList = () => router.push(base, { scroll: false });
  const closeCreate = () => {
    setDialog(null);
    if (go === "new") {
      setNewConsumed(true);
      router.replace(base, { scroll: false });
    }
  };

  async function confirmDelete() {
    if (!activePhase) return;
    setDeleting(true);
    try {
      await http(`/phases/${activePhase._id}`, { method: "DELETE" });
      toast.success("Fase eliminada");
      setDialog(null);
      phases.reload();
      router.replace(base, { scroll: false });
    } catch (err) {
      toast.error(errorMessage(err));
      setDialog(null);
    } finally {
      setDeleting(false);
    }
  }

  if (activePhase) {
    return (
      <>
        <PhaseDetail
          key={activePhase._id}
          championshipId={championshipId}
          phase={activePhase}
          tab={tab ?? "general"}
          onTab={(next) => router.replace(`${base}&phase=${activePhase._id}&tab=${next}`, { scroll: false })}
          onClose={backToList}
          onChanged={phases.reload}
          onDelete={() => setDialog("delete")}
        />
        <ConfirmDialog
          open={dialog === "delete"}
          title="Eliminar fase"
          message={
            activePhase.matches.total > 0 || activePhase.teamCount > 0
              ? `"${activePhase.name}" tiene ${activePhase.matches.total} partido(s) y ${activePhase.teamCount} equipo(s) vinculados. Al eliminarla se borrarán también esos partidos con sus eventos, convocatorias y asistencia. Los equipos no se eliminan, solo quedan sin esta fase. Esta acción no se puede deshacer.`
              : `¿Eliminar "${activePhase.name}"? Esta acción no se puede deshacer.`
          }
          confirmLabel="Eliminar de todas formas"
          loading={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDialog(null)}
        />
      </>
    );
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: "var(--space-lg)" }}>
        <p className="text-secondary">Cómo se juega el torneo: liga, grupos o eliminatoria, en el orden en que se juegan.</p>
        <Button icon={<Plus size={18} />} className="only-desktop" onClick={() => setDialog("new")}>Nueva fase</Button>
      </div>
      <Fab label="Fases" actions={[{ label: "Nueva fase", icon: <Plus size={20} />, onClick: () => setDialog("new") }]} />

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Layers size={28} />}
            title="Este torneo aún no tiene fases"
            description="Crea las fases en el orden en que se juegan, por ejemplo: una fase de grupos y después una liga final. Tú eliges qué equipos participan en cada una."
            action={<Button onClick={() => setDialog("new")}>Crear la primera fase</Button>}
          />
        </div>
      ) : (
        <div className="manage-config-list" aria-label="Fases del torneo">
          {list.map((phase) => {
            const warning = phaseWarning(phase);
            return (
              <button key={phase._id} className="manage-config-row" onClick={() => openPhase(phase._id)}>
                <span className="phase-order-badge" aria-hidden style={{ flexShrink: 0 }}>{phase.order}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="text-strong truncate" style={{ display: "block" }}>{phase.name}</span>
                  <span className="text-secondary text-small" style={{ display: "block" }}>{PHASE_TYPE_LABEL[phase.type]} · {phaseSummary(phase)}</span>
                </span>
                {warning && <Badge tone="warning">{warning}</Badge>}
                <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
              </button>
            );
          })}
        </div>
      )}

      <PhaseFormModal
        open={creating}
        championshipId={championshipId}
        phase={null}
        onClose={closeCreate}
        onSaved={() => {
          closeCreate();
          phases.reload();
        }}
      />
    </>
  );
}

function phaseSummary(phase: PhaseDTO): string {
  if (phase.type === "knockout") return `${phase.rounds.length} ronda(s)${phase.ties ? ` · ${phase.ties.decided}/${phase.ties.total} cruces definidos` : ""}`;
  const matches = phase.matches.total > 0 ? `${phase.matches.finished}/${phase.matches.total} partidos jugados` : "sin partidos";
  return `${phase.teamCount} equipos · ${matches}`;
}

/** What the phase still needs, so the list says where to continue. */
function phaseWarning(phase: PhaseDTO): string | null {
  if (phase.type === "knockout") return phase.rounds.length === 0 ? "Sin rondas" : null;
  if (phase.teamCount < 2) return "Faltan equipos";
  if (phase.matches.total === 0) return "Sin calendario";
  return null;
}

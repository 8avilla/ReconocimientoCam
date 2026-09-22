"use client";

import { useState } from "react";
import { Gavel, Plus } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { FinesView } from "@/components/sanction/FinesView";
import { SuspensionFormModal } from "@/components/sanction/SuspensionFormModal";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { formatDate, SUSPENSION_REASON_LABEL, SUSPENSION_STATUS_LABEL } from "@/lib/labels";
import type { Paginated, SuspensionDTO } from "@/types/api";

const FILTERS = [
  { id: "active", label: "Vigentes" },
  { id: "served", label: "Cumplidas" },
  { id: "lifted", label: "Levantadas" },
  { id: "", label: "Todas" },
];

export function SanctionsView() {
  return <RequireChampionship>{(championship) => <Sanctions championshipId={championship._id} />}</RequireChampionship>;
}

function Sanctions({ championshipId }: { championshipId: string }) {
  const { can } = useRole();
  const manage = can("sanction.manage");
  const toast = useToast();
  const [status, setStatus] = useState("active");
  // Suspensions or fines (money); fines are only for those who manage sanctions.
  const [storedSection, setSection] = useStoredState<"suspensions" | "fines">("super-torneos:sanctions:section", "suspensions", (value) => value === "suspensions" || value === "fines");
  const section = manage ? storedSection : "suspensions";
  const [formOpen, setFormOpen] = useState(false);
  const [fineFormOpen, setFineFormOpen] = useState(false);
  const [lifting, setLifting] = useState<SuspensionDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useFetch<Paginated<SuspensionDTO>>(
    `/suspensions?championshipId=${championshipId}&limit=100${status ? `&status=${status}` : ""}`
  );
  const items = data?.data ?? [];

  async function confirmLift() {
    if (!lifting) return;
    setBusy(true);
    try {
      await http(`/suspensions/${lifting._id}/lift`, { json: {} });
      toast.success("Suspensión levantada");
      setLifting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sanciones"
        description="Suspensiones por tarjetas y decisiones del comité."
        actions={manage && <Button icon={<Plus size={18} />} onClick={() => (section === "fines" ? setFineFormOpen(true) : setFormOpen(true))}>{section === "fines" ? "Nueva multa" : "Nueva suspensión"}</Button>}
        mobileActions={manage ? [section === "fines" ? { label: "Nueva multa", icon: <Plus size={20} />, onClick: () => setFineFormOpen(true) } : { label: "Nueva suspensión", icon: <Plus size={20} />, onClick: () => setFormOpen(true) }] : undefined}
      />

      {manage && (
        <div className="segmented" role="group" aria-label="Tipo de sanción" style={{ marginBottom: "var(--space-lg)" }}>
          <button aria-pressed={section === "suspensions"} className={section === "suspensions" ? "active" : ""} onClick={() => setSection("suspensions")}>Suspensiones</button>
          <button aria-pressed={section === "fines"} className={section === "fines" ? "active" : ""} onClick={() => setSection("fines")}>Multas</button>
        </div>
      )}

      {section === "fines" ? (
        <FinesView championshipId={championshipId} newOpen={fineFormOpen} onNewClose={() => setFineFormOpen(false)} />
      ) : (
      <>
      <div className="tabs-line" role="tablist" aria-label="Filtrar sanciones">
        {FILTERS.map((filter) => (
          <button key={filter.id} role="tab" aria-selected={status === filter.id} className={`tab-line${status === filter.id ? " active" : ""}`} onClick={() => setStatus(filter.id)}>
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Gavel size={28} />} title="Sin sanciones" description={status === "active" ? "No hay jugadores suspendidos." : "No hay sanciones con ese estado."} />
        </div>
      ) : (
        <div className="flush-list">
          <h2 className="band band-muted band-small">{FILTERS.find((filter) => filter.id === status)?.label ?? "Sanciones"} ({items.length})</h2>
          {items.map((item) => {
            const state = SUSPENSION_STATUS_LABEL[item.status];
            return (
              <div key={item._id} className="list-row" style={{ alignItems: "flex-start" }}>
                <Avatar src={item.playerId.photoUrl} name={item.playerId.fullName} size={44} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="champ-caption truncate">{item.teamId.name} · {SUSPENSION_REASON_LABEL[item.reason]}</div>
                  <div className="champ-name truncate">{item.playerId.fullName}</div>
                  <div className="text-secondary text-small">{formatDate(item.createdAt)} · {item.matchesServed}/{item.matchesToServe} partidos</div>
                  {item.note && <div className="text-secondary text-small">{item.note}</div>}
                </div>
                <div className="stack-sm" style={{ alignItems: "flex-end" }}>
                  <Badge tone={state.tone}>{state.label}</Badge>
                  {manage && item.status === "active" && <Button variant="secondary" size="small" onClick={() => setLifting(item)}>Levantar</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>
      )}

      <SuspensionFormModal
        open={formOpen}
        championshipId={championshipId}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
      <ConfirmDialog
        open={lifting !== null}
        title="Levantar suspensión"
        message={`¿Levantar la suspensión de ${lifting?.playerId.fullName}? El jugador quedará habilitado de inmediato.`}
        confirmLabel="Levantar"
        loading={busy}
        onConfirm={confirmLift}
        onClose={() => setLifting(null)}
      />
    </>
  );
}

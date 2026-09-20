"use client";

import { useState } from "react";
import { Gavel, Plus } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { SuspensionFormModal } from "@/components/sanction/SuspensionFormModal";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { formatDate, SUSPENSION_REASON_LABEL, SUSPENSION_STATUS_LABEL } from "@/lib/labels";
import type { Paginated, SuspensionDTO } from "@/types/api";

const FILTERS = [
  { id: "active", label: "Vigentes" },
  { id: "served", label: "Cumplidas" },
  { id: "lifted", label: "Levantadas" },
  { id: "", label: "Todas" },
];

export default function SanctionsPage() {
  return <RequireChampionship>{(championship) => <Sanctions championshipId={championship._id} />}</RequireChampionship>;
}

function Sanctions({ championshipId }: { championshipId: string }) {
  const toast = useToast();
  const [status, setStatus] = useState("active");
  const [formOpen, setFormOpen] = useState(false);
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
        actions={<Button icon={<Plus size={18} />} onClick={() => setFormOpen(true)}>Nueva suspensión</Button>}
      />

      <div className="row-wrap" role="tablist" aria-label="Filtrar sanciones" style={{ marginBottom: "var(--space-lg)" }}>
        {FILTERS.map((filter) => (
          <Button key={filter.id} role="tab" size="small" aria-selected={status === filter.id} variant={status === filter.id ? "primary" : "secondary"} onClick={() => setStatus(filter.id)}>
            {filter.label}
          </Button>
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
        <div className="card flush">
          {items.map((item) => {
            const state = SUSPENSION_STATUS_LABEL[item.status];
            return (
              <div key={item._id} className="list-row">
                <Avatar src={item.playerId.photoUrl} name={item.playerId.fullName} size={44} />
                <div className="grow">
                  <div className="text-strong truncate">{item.playerId.fullName}</div>
                  <div className="text-secondary text-small">
                    {item.teamId.name} · {SUSPENSION_REASON_LABEL[item.reason]} · {formatDate(item.createdAt)}
                  </div>
                  {item.note && <div className="text-secondary text-small">{item.note}</div>}
                </div>
                <div style={{ textAlign: "right" }} className="stack-sm">
                  <Badge tone={state.tone}>{state.label}</Badge>
                  <span className="text-secondary text-small">{item.matchesServed} / {item.matchesToServe} partidos</span>
                </div>
                {item.status === "active" && (
                  <Button variant="ghost" size="small" onClick={() => setLifting(item)}>Levantar</Button>
                )}
              </div>
            );
          })}
        </div>
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

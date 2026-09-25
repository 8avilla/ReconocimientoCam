"use client";

import { useState } from "react";
import Link from "next/link";
import { Gavel, Plus, Search, ShieldAlert, AlertTriangle, CheckCircle2, Shield, Banknote, User } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  // Suspensions or fines (money); fines are only for those who manage sanctions.
  const [storedSection, setSection] = useStoredState<"suspensions" | "fines">("super-torneos:sanctions:section", "suspensions", (value) => value === "suspensions" || value === "fines");
  const section = manage ? storedSection : "suspensions";
  const [formOpen, setFormOpen] = useState(false);
  const [fineFormOpen, setFineFormOpen] = useState(false);
  const [lifting, setLifting] = useState<SuspensionDTO | null>(null);
  const [busy, setBusy] = useState(false);
  
  // Fetch active suspensions overview counter
  const activeOverview = useFetch<Paginated<SuspensionDTO>>(`/suspensions?championshipId=${championshipId}&status=active&limit=1`);
  const activeCount = activeOverview.data?.meta.total ?? 0;

  const { data, error, loading, reload } = useFetch<Paginated<SuspensionDTO>>(
    `/suspensions?championshipId=${championshipId}&limit=100${status ? `&status=${status}` : ""}`
  );
  const rawItems = data?.data ?? [];
  
  const items = rawItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.playerId.fullName.toLowerCase().includes(q) || item.teamId.name.toLowerCase().includes(q);
  });

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
          <button aria-pressed={section === "suspensions"} className={section === "suspensions" ? "active" : ""} onClick={() => setSection("suspensions")}>
            <ShieldAlert size={16} aria-hidden style={{ marginRight: 6, verticalAlign: "-2px" }} />
            Suspensiones ({activeCount})
          </button>
          <button aria-pressed={section === "fines"} className={section === "fines" ? "active" : ""} onClick={() => setSection("fines")}>
            <Banknote size={16} aria-hidden style={{ marginRight: 6, verticalAlign: "-2px" }} />
            Multas & Tasas
          </button>
        </div>
      )}

      {section === "fines" ? (
        <FinesView championshipId={championshipId} newOpen={fineFormOpen} onNewClose={() => setFineFormOpen(false)} />
      ) : (
      <>
      <div className="card-hub-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
        <div className="card stack-xs" style={{ borderLeft: "4px solid var(--color-warning)" }}>
          <span className="text-secondary text-small row" style={{ gap: 6 }}>
            <ShieldAlert size={16} color="var(--color-warning)" aria-hidden /> Suspensiones Vigentes
          </span>
          <strong style={{ fontSize: 24 }}>{activeCount}</strong>
        </div>
        <div className="card stack-xs" style={{ borderLeft: "4px solid var(--color-primary)" }}>
          <span className="text-secondary text-small row" style={{ gap: 6 }}>
            <CheckCircle2 size={16} color="var(--color-primary)" aria-hidden /> Sanciones Registradas
          </span>
          <strong style={{ fontSize: 24 }}>{data?.meta.total ?? 0}</strong>
        </div>
      </div>

      <div className="row-wrap" style={{ gap: "var(--space-md)", marginBottom: "var(--space-md)", alignItems: "center" }}>
        <div className="tabs-line grow" role="tablist" aria-label="Filtrar sanciones" style={{ marginBottom: 0 }}>
          {FILTERS.map((filter) => (
            <button key={filter.id} role="tab" aria-selected={status === filter.id} className={`tab-line${status === filter.id ? " active" : ""}`} onClick={() => setStatus(filter.id)}>
              {filter.label}
            </button>
          ))}
        </div>
        <div className="search-field" style={{ minWidth: 200, flexShrink: 0 }}>
          <Search size={16} className="search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Buscar por jugador o equipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-search"
            style={{ paddingLeft: 34 }}
          />
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Gavel size={28} />} title="Sin sanciones" description={searchQuery ? "No se encontraron sanciones con ese término." : status === "active" ? "No hay jugadores suspendidos." : "No hay sanciones con ese estado."} />
        </div>
      ) : (
        <div className="flush-list">
          <h2 className="band band-muted band-small">{FILTERS.find((filter) => filter.id === status)?.label ?? "Sanciones"} ({items.length})</h2>
          {items.map((item) => {
            const state = SUSPENSION_STATUS_LABEL[item.status];
            const progressPercent = item.matchesToServe > 0 ? Math.min(100, Math.round((item.matchesServed / item.matchesToServe) * 100)) : 100;
            
            return (
              <div key={item._id} className="list-row" style={{ alignItems: "flex-start", gap: "var(--space-md)", padding: "var(--space-md)" }}>
                <Link href={`/players/${item.playerId._id}`}>
                  <Avatar src={item.playerId.photoUrl} name={item.playerId.fullName} size={48} />
                </Link>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row-wrap" style={{ gap: 6, alignItems: "center", marginBottom: 2 }}>
                    <span className="champ-caption truncate">
                      <Link href={`/teams/${item.teamId._id}`} className="text-strong">{item.teamId.name}</Link>
                    </span>
                    <span className="text-secondary text-micro">•</span>
                    <span className={`reason-pill reason-${item.reason}`}>
                      {item.reason === "red_card" ? "🔴 " : item.reason === "yellow_accumulation" ? "🟨 " : "⚖️ "}
                      {SUSPENSION_REASON_LABEL[item.reason]}
                    </span>
                  </div>
                  <div className="champ-name truncate" style={{ fontSize: 16, fontWeight: 600 }}>
                    <Link href={`/players/${item.playerId._id}`}>{item.playerId.fullName}</Link>
                  </div>
                  
                  {/* Progress bar for matches served */}
                  <div style={{ marginTop: 8, maxWidth: 300 }}>
                    <div className="row-between text-micro text-secondary" style={{ marginBottom: 3 }}>
                      <span>Partidos cumplidos: <strong className="text-strong">{item.matchesServed} / {item.matchesToServe}</strong></span>
                      <span className="text-strong">{progressPercent}%</span>
                    </div>
                    <div style={{ height: 6, width: "100%", backgroundColor: "var(--color-bg-subtle, rgba(255,255,255,0.08))", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? "var(--color-success)" : "var(--color-warning)", transition: "width 0.3s ease" }} />
                    </div>
                  </div>

                  <div className="text-secondary text-small" style={{ marginTop: 6 }}>
                    Registrada el {formatDate(item.createdAt)}
                  </div>
                  {item.note && <div className="text-secondary text-small" style={{ fontStyle: "italic", marginTop: 2 }}>"{item.note}"</div>}
                </div>
                <div className="stack-sm" style={{ alignItems: "flex-end", flexShrink: 0 }}>
                  <Badge tone={state.tone}>{state.label}</Badge>
                  {manage && item.status === "active" && (
                    <Button variant="secondary" size="small" onClick={() => setLifting(item)}>Levantar</Button>
                  )}
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


"use client";

import { useState } from "react";
import { Banknote, Wallet } from "lucide-react";
import { Avatar, Badge, EmptyState, ErrorState, Loading } from "@/components/ui";
import { FineModal } from "@/components/sanction/FineModal";
import { ManualFineModal } from "@/components/sanction/ManualFineModal";
import { useFetch } from "@/lib/client/useFetch";
import { FINE_STATUS_LABEL, formatMoney } from "@/lib/labels";
import type { FineDTO, FinesDTO } from "@/types/api";

const FILTERS = [
  { id: "open", label: "Por cobrar" },
  { id: "paid", label: "Pagadas" },
  { id: "waived", label: "Perdonadas" },
  { id: "", label: "Todas" },
];

/** Fines of the championship (mostly card fines): what each team owes, and the payments received. */
export function FinesView({ championshipId, newOpen, onNewClose }: { championshipId: string; newOpen: boolean; onNewClose: () => void }) {
  const [status, setStatus] = useState("open");
  const [teamId, setTeamId] = useState("");
  const [selected, setSelected] = useState<FineDTO | null>(null);
  const { data, error, loading, reload } = useFetch<FinesDTO>(
    `/fines?championshipId=${championshipId}&limit=100${status ? `&status=${status}` : ""}${teamId ? `&teamId=${teamId}` : ""}`
  );
  const fines = data?.data ?? [];
  const summary = data?.summary;
  // Keep the open modal in sync with the reloaded list.
  const current = selected ? fines.find((fine) => fine._id === selected._id) ?? selected : null;

  return (
    <>
      <div className="fine-summary">
        <div className="card stack-sm">
          <span className="text-secondary text-small row"><Wallet size={16} aria-hidden /> Por cobrar</span>
          <strong style={{ fontSize: 24, color: summary && summary.owed > 0 ? "var(--color-warning)" : undefined }}>{summary ? formatMoney(summary.owed) : "–"}</strong>
        </div>
        <div className="card stack-sm">
          <span className="text-secondary text-small row"><Banknote size={16} aria-hidden /> Recaudado</span>
          <strong style={{ fontSize: 24, color: "var(--color-success)" }}>{summary ? formatMoney(summary.collected) : "–"}</strong>
        </div>
      </div>

      {summary && summary.byTeam.length > 0 && (
        <div className="phase-chips" role="tablist" aria-label="Equipos que deben">
          <button role="tab" aria-selected={teamId === ""} className={`phase-chip${teamId === "" ? " active" : ""}`} onClick={() => setTeamId("")}>Todos</button>
          {summary.byTeam.map((team) => (
            <button key={team.teamId} role="tab" aria-selected={teamId === team.teamId} className={`phase-chip${teamId === team.teamId ? " active" : ""}`} onClick={() => setTeamId(team.teamId)}>
              {team.name} · {formatMoney(team.owed)}
            </button>
          ))}
        </div>
      )}

      <div className="tabs-line" role="tablist" aria-label="Estado de las multas">
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
      ) : fines.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Banknote size={28} />}
            title="Sin multas"
            description={status === "open" ? "Nadie debe nada por ahora. Las multas por tarjeta se cobran al registrar las tarjetas si defines su valor en las reglas del campeonato." : "No hay multas con ese estado."}
          />
        </div>
      ) : (
        <div className="flush-list">
          <h2 className="band band-muted band-small">{FILTERS.find((filter) => filter.id === status)?.label ?? "Multas"} ({data?.meta.total ?? fines.length})</h2>
          {fines.map((fine) => {
            const state = FINE_STATUS_LABEL[fine.status];
            const open = fine.status === "pending" || fine.status === "partial";
            const match = fine.matchId ? `${fine.matchId.homeTeamId.name} vs ${fine.matchId.awayTeamId.name}` : null;
            return (
              <button key={fine._id} className="list-row fine-row" onClick={() => setSelected(fine)} aria-label={`Ver multa de ${fine.playerId?.fullName ?? fine.concept}`}>
                <Avatar src={fine.playerId?.photoUrl ?? fine.teamId.shieldUrl} name={fine.playerId?.fullName ?? fine.teamId.name} size={44} square={!fine.playerId} />
                <div className="grow" style={{ minWidth: 0, textAlign: "left" }}>
                  <div className="champ-caption truncate">{fine.teamId.name} · {fine.concept}</div>
                  <div className="champ-name truncate">{fine.playerId?.fullName ?? fine.concept}</div>
                  {match && <div className="text-secondary text-small truncate">{match}</div>}
                </div>
                <div className="stack-sm" style={{ alignItems: "flex-end", gap: 4 }}>
                  <strong>{formatMoney(fine.amount)}</strong>
                  <Badge tone={state.tone}>{fine.status === "partial" ? `Debe ${formatMoney(fine.amount - fine.paidAmount)}` : state.label}</Badge>
                  {open && <span className="text-small text-strong" style={{ color: "var(--color-primary)" }}>Registrar pago</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {current && <FineModal fine={current} onClose={() => setSelected(null)} onChanged={reload} />}
      <ManualFineModal open={newOpen} championshipId={championshipId} onClose={onNewClose} onSaved={() => { onNewClose(); reload(); }} />
    </>
  );
}

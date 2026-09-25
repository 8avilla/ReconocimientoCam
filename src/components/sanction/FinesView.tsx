"use client";

import { useState } from "react";
import { Banknote, Wallet, Search, CheckCircle2, DollarSign } from "lucide-react";
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
export function FinesView({
  championshipId,
  newOpen,
  onNewClose,
  type,
}: {
  championshipId: string;
  newOpen: boolean;
  onNewClose: () => void;
  /** Restricts the list to one fine type (e.g. "registration" for the team's inscription fee); omitted shows every type except "registration" — see `listFines`. */
  type?: FineDTO["type"];
}) {
  const [status, setStatus] = useState("open");
  const [teamId, setTeamId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<FineDTO | null>(null);
  const { data, error, loading, reload } = useFetch<FinesDTO>(
    `/fines?championshipId=${championshipId}&limit=100${status ? `&status=${status}` : ""}${teamId ? `&teamId=${teamId}` : ""}${type ? `&type=${type}` : ""}`
  );
  const rawFines = data?.data ?? [];
  const summary = data?.summary;

  const fines = rawFines.filter((fine) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const targetName = fine.playerId?.fullName ?? fine.concept;
    return targetName.toLowerCase().includes(q) || fine.teamId.name.toLowerCase().includes(q) || fine.concept.toLowerCase().includes(q);
  });

  // Keep the open modal in sync with the reloaded list.
  const current = selected ? rawFines.find((fine) => fine._id === selected._id) ?? selected : null;

  return (
    <>
      <div className="fine-summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-md)", marginBottom: "var(--space-md)" }}>
        <div className="card stack-xs" style={{ borderLeft: "4px solid var(--color-warning)", padding: "var(--space-md)" }}>
          <span className="text-secondary text-small row" style={{ gap: 6 }}><Wallet size={16} color="var(--color-warning)" aria-hidden /> Por cobrar</span>
          <strong style={{ fontSize: 24, color: summary && summary.owed > 0 ? "var(--color-warning)" : undefined }}>{summary ? formatMoney(summary.owed) : "–"}</strong>
        </div>
        <div className="card stack-xs" style={{ borderLeft: "4px solid var(--color-success)", padding: "var(--space-md)" }}>
          <span className="text-secondary text-small row" style={{ gap: 6 }}><Banknote size={16} color="var(--color-success)" aria-hidden /> Recaudado</span>
          <strong style={{ fontSize: 24, color: "var(--color-success)" }}>{summary ? formatMoney(summary.collected) : "–"}</strong>
        </div>
      </div>

      {summary && summary.byTeam.length > 0 && (
        <div className="phase-chips" role="tablist" aria-label="Equipos que deben" style={{ marginBottom: "var(--space-md)" }}>
          <button role="tab" aria-selected={teamId === ""} className={`phase-chip${teamId === "" ? " active" : ""}`} onClick={() => setTeamId("")}>Todos los deudores</button>
          {summary.byTeam.map((team) => (
            <button key={team.teamId} role="tab" aria-selected={teamId === team.teamId} className={`phase-chip${teamId === team.teamId ? " active" : ""}`} onClick={() => setTeamId(team.teamId)}>
              {team.name} · <strong style={{ color: "var(--color-warning)" }}>{formatMoney(team.owed)}</strong>
            </button>
          ))}
        </div>
      )}

      <div className="row-wrap" style={{ gap: "var(--space-md)", marginBottom: "var(--space-md)", alignItems: "center" }}>
        <div className="tabs-line grow" role="tablist" aria-label="Estado de las multas" style={{ marginBottom: 0 }}>
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
            placeholder="Buscar por equipo, concepto..."
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
      ) : fines.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Banknote size={28} />}
            title={type === "registration" ? "Sin cuotas" : "Sin multas"}
            description={
              searchQuery
                ? "No se encontraron registros de cobro con ese término."
                : status !== "open"
                ? `No hay ${type === "registration" ? "cuotas" : "multas"} con ese estado.`
                : type === "registration"
                ? "Nadie debe nada por ahora. La cuota de inscripción se cobra a cada equipo nuevo si defines su valor en las reglas del campeonato."
                : "Nadie debe nada por ahora. Las multas por tarjeta se cobran al registrar las tarjetas si defines su valor en las reglas del campeonato."
            }
          />
        </div>
      ) : (
        <div className="flush-list">
          <h2 className="band band-muted band-small">{FILTERS.find((filter) => filter.id === status)?.label ?? "Multas"} ({fines.length})</h2>
          {fines.map((fine) => {
            const state = FINE_STATUS_LABEL[fine.status];
            const open = fine.status === "pending" || fine.status === "partial";
            const match = fine.matchId ? `${fine.matchId.homeTeamId.name} vs ${fine.matchId.awayTeamId.name}` : null;
            const owedAmount = fine.amount - fine.paidAmount;

            return (
              <button key={fine._id} className="list-row fine-row" onClick={() => setSelected(fine)} aria-label={`Ver multa de ${fine.playerId?.fullName ?? fine.concept}`} style={{ padding: "var(--space-md)", alignItems: "center", textDecoration: "none" }}>
                <Avatar src={fine.playerId?.photoUrl ?? fine.teamId.shieldUrl} name={fine.playerId?.fullName ?? fine.teamId.name} size={48} square={!fine.playerId} />
                <div className="grow" style={{ minWidth: 0, textAlign: "left" }}>
                  <div className="champ-caption truncate">
                    <span className="text-strong">{fine.teamId.name}</span> • {fine.concept}
                  </div>
                  <div className="champ-name truncate" style={{ fontSize: 16, fontWeight: 600 }}>
                    {fine.playerId?.fullName ?? fine.concept}
                  </div>
                  {match && <div className="text-secondary text-small truncate">Partido: {match}</div>}
                </div>
                <div className="stack-sm" style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <strong style={{ fontSize: 16, color: open ? "var(--color-warning)" : "var(--color-text-primary)" }}>{formatMoney(fine.amount)}</strong>
                  <Badge tone={state.tone}>
                    {fine.status === "partial" ? `Debe ${formatMoney(owedAmount)}` : state.label}
                  </Badge>
                  {open && <span className="text-small text-strong" style={{ color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4 }}><DollarSign size={14} /> Registrar pago</span>}
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


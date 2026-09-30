"use client";

import { useEffect, useState } from "react";
import { Banknote, ChevronLeft, ChevronRight, Receipt, Search, SlidersHorizontal } from "lucide-react";
import { ActionMenu, Avatar, Badge, Button, EmptyState, ErrorState, Loading, Modal } from "@/components/ui";
import { FineModal } from "@/components/sanction/FineModal";
import { ManualFineModal } from "@/components/sanction/ManualFineModal";
import { useFetch } from "@/lib/client/useFetch";
import { FINE_STATUS_LABEL, formatDate, formatMoney } from "@/lib/labels";
import type { FineDTO, FinesDTO } from "@/types/api";

const FILTERS = [
  { id: "open", label: "Por cobrar" },
  { id: "paid", label: "Pagadas" },
  { id: "waived", label: "Perdonadas" },
  { id: "", label: "Todas" },
];

const TYPE_OPTIONS: { id: FineDTO["type"] | ""; label: string }[] = [
  { id: "", label: "Todos los tipos" },
  { id: "yellow_card", label: "Tarjeta amarilla" },
  { id: "red_card", label: "Tarjeta roja" },
  { id: "manual", label: "Multa manual" },
];

const PAGE_SIZES = [10, 25, 50];

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
  /** Restricts the list to one fine type (e.g. "registration" for the team's inscription fee); omitted allows the "Filtros" type picker and shows every type except "registration" — see `listFines`. */
  type?: FineDTO["type"];
}) {
  const [status, setStatus] = useState("open");
  const [teamId, setTeamId] = useState("");
  const [typeFilter, setTypeFilter] = useState<FineDTO["type"] | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<FineDTO | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  // Any other change to what's being asked for also starts back at page 1.
  const changeStatus = (value: string) => { setStatus(value); setPage(1); };
  const changeTeam = (value: string) => { setTeamId(value); setPage(1); };
  const changeLimit = (value: number) => { setLimit(value); setPage(1); };

  const effectiveType = type ?? (typeFilter || undefined);
  const { data, error, loading, reload } = useFetch<FinesDTO>(
    `/fines?championshipId=${championshipId}&page=${page}&limit=${limit}${status ? `&status=${status}` : ""}${teamId ? `&teamId=${teamId}` : ""}${effectiveType ? `&type=${effectiveType}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`
  );
  const fines = data?.data ?? [];
  const summary = data?.summary;
  const total = data?.meta.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  // Keep the open modal in sync with the reloaded list.
  const current = selected ? fines.find((fine) => fine._id === selected._id) ?? selected : null;

  const countFor = (id: string) => (id === "" ? summary?.counts.all : id === "open" ? summary?.counts.open : id === "paid" ? summary?.counts.paid : summary?.counts.waived) ?? 0;

  return (
    <>
      <div className="fine-summary">
        <button className="card fine-summary-card" style={{ borderLeft: "4px solid var(--color-warning)" }} onClick={() => changeStatus("open")}>
          <span className="fine-summary-icon" style={{ background: "#fef3c7", color: "var(--color-warning)" }}><Receipt size={20} aria-hidden /></span>
          <span className="grow">
            <span className="text-secondary text-small" style={{ display: "block" }}>Por cobrar</span>
            <strong style={{ fontSize: 22, color: summary && summary.owed > 0 ? "var(--color-warning)" : undefined }}>{summary ? formatMoney(summary.owed) : "–"}</strong>
            <span className="text-secondary text-small" style={{ display: "block" }}>{summary?.counts.open ?? 0} multas</span>
          </span>
          <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
        </button>
        <button className="card fine-summary-card" style={{ borderLeft: "4px solid var(--color-success)" }} onClick={() => changeStatus("paid")}>
          <span className="fine-summary-icon" style={{ background: "#dcfce7", color: "var(--color-success)" }}><Banknote size={20} aria-hidden /></span>
          <span className="grow">
            <span className="text-secondary text-small" style={{ display: "block" }}>Recaudado</span>
            <strong style={{ fontSize: 22, color: "var(--color-success)" }}>{summary ? formatMoney(summary.collected) : "–"}</strong>
            <span className="text-secondary text-small" style={{ display: "block" }}>{summary?.counts.paid ?? 0} multas</span>
          </span>
          <ChevronRight size={18} aria-hidden color="var(--color-text-disabled)" />
        </button>
      </div>

      {summary && summary.byTeam.length > 0 && (
        <div className="phase-chips" role="tablist" aria-label="Equipos que deben" style={{ marginBottom: "var(--space-md)" }}>
          <button role="tab" aria-selected={teamId === ""} className={`phase-chip${teamId === "" ? " active" : ""}`} onClick={() => changeTeam("")}>
            Todos los deudores · <strong>{formatMoney(summary.owed)}</strong> ({summary.counts.open})
          </button>
          {summary.byTeam.map((team) => (
            <button key={team.teamId} role="tab" aria-selected={teamId === team.teamId} className={`phase-chip${teamId === team.teamId ? " active" : ""}`} onClick={() => changeTeam(team.teamId)}>
              {team.name} · <strong style={{ color: "var(--color-warning)" }}>{formatMoney(team.owed)}</strong> ({team.count})
            </button>
          ))}
        </div>
      )}

      <div className="row-wrap" style={{ gap: "var(--space-md)", marginBottom: "var(--space-md)", alignItems: "center" }}>
        <div className="search-field grow" style={{ minWidth: 200 }}>
          <Search size={16} className="search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Buscar jugador, equipo, tipo de sanción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-search"
            style={{ paddingLeft: 34 }}
          />
        </div>
        {!type && (
          <Button variant="secondary" icon={<SlidersHorizontal size={16} />} onClick={() => setFiltersOpen(true)}>
            Filtros{typeFilter && " (1)"}
          </Button>
        )}
      </div>

      <div className="filter-chips" role="tablist" aria-label="Estado de las multas">
        {FILTERS.map((filter) => (
          <button key={filter.id} role="tab" aria-selected={status === filter.id} className={`filter-chip${status === filter.id ? " active" : ""}`} onClick={() => changeStatus(filter.id)}>
            {filter.label} ({countFor(filter.id)})
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
            title={type === "registration" ? "Sin cuotas" : "Sin multas"}
            description={
              query
                ? "No se encontraron registros de cobro con ese término."
                : status !== "open"
                ? `No hay ${type === "registration" ? "cuotas" : "multas"} con ese estado.`
                : type === "registration"
                ? "Nadie debe nada por ahora. La cuota de inscripción se cobra a cada equipo nuevo si defines su valor en las reglas del torneo."
                : "Nadie debe nada por ahora. Las multas por tarjeta se cobran al registrar las tarjetas si defines su valor en las reglas del torneo."
            }
            action={query && <Button variant="secondary" onClick={() => setSearch("")}>Limpiar búsqueda</Button>}
          />
        </div>
      ) : (
        <>
          {/* Desktop: a real table. */}
          <div className="flush-list only-desktop">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Equipo</th>
                    <th>Tipo de sanción</th>
                    <th>Partido</th>
                    <th>Fecha</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((fine) => (
                    <FineRow key={fine._id} fine={fine} onView={() => setSelected(fine)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: one card per fine. */}
          <div className="flush-list only-mobile">
            {fines.map((fine) => (
              <FineCard key={fine._id} fine={fine} onView={() => setSelected(fine)} />
            ))}
          </div>

          <div className="row-between" style={{ marginTop: "var(--space-md)", flexWrap: "wrap", gap: "var(--space-sm)" }}>
            <span className="text-secondary text-small">Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, total)} de {total} sanciones</span>
            <div className="row" style={{ gap: "var(--space-sm)" }}>
              <button className="icon-button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={18} aria-hidden />
              </button>
              <span className="text-small">{page} / {pageCount}</span>
              <button className="icon-button" aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                <ChevronRight size={18} aria-hidden />
              </button>
              <select className="input" aria-label="Sanciones por página" value={limit} onChange={(e) => changeLimit(Number(e.target.value))} style={{ width: "auto", fontSize: 13 }}>
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} por página</option>)}
              </select>
            </div>
          </div>
        </>
      )}

      {current && <FineModal fine={current} onClose={() => setSelected(null)} onChanged={reload} />}
      <ManualFineModal open={newOpen} championshipId={championshipId} onClose={onNewClose} onSaved={() => { onNewClose(); reload(); }} onCreatedAnother={reload} />

      <Modal open={filtersOpen} title="Filtros" onClose={() => setFiltersOpen(false)}>
        <div className="stack">
          <label className="stack-sm">
            <span className="text-small text-strong">Tipo de sanción</span>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as FineDTO["type"] | "")}>
              {TYPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <Button onClick={() => { setPage(1); setFiltersOpen(false); }}>Aplicar</Button>
        </div>
      </Modal>
    </>
  );
}

function fineTone(type: FineDTO["type"]): "warning" | "error" | "neutral" {
  return type === "yellow_card" ? "warning" : type === "red_card" ? "error" : "neutral";
}

const CONCEPT_LABEL: Record<FineDTO["type"], string> = {
  yellow_card: "Tarjeta amarilla",
  red_card: "Tarjeta roja",
  manual: "Multa manual",
  registration: "Cuota de inscripción",
};

function FineRow({ fine, onView }: { fine: FineDTO; onView: () => void }) {
  const state = FINE_STATUS_LABEL[fine.status];
  const open = fine.status === "pending" || fine.status === "partial";
  const match = fine.matchId ? `${fine.matchId.homeTeamId.name} vs ${fine.matchId.awayTeamId.name}` : "—";
  const owedAmount = fine.amount - fine.paidAmount;
  const who = fine.playerId?.fullName ?? fine.teamId.name;

  return (
    <tr>
      <td>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <Avatar src={fine.playerId?.photoUrl} name={who} size={36} square={!fine.playerId} />
          <div style={{ minWidth: 0 }}>
            <div className="text-strong truncate">{who}</div>
            {fine.playerId?.documentId && <div className="text-secondary text-small">CC {fine.playerId.documentId}</div>}
          </div>
        </div>
      </td>
      <td>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <Avatar src={fine.teamId.shieldUrl} name={fine.teamId.name} size={24} square />
          <span className="truncate">{fine.teamId.name}</span>
        </div>
      </td>
      <td>
        <Badge tone={fineTone(fine.type)}>{CONCEPT_LABEL[fine.type]}</Badge>
        {fine.note && <div className="text-secondary text-small" style={{ marginTop: 2 }}>{fine.note}</div>}
      </td>
      <td className="text-secondary">{match}</td>
      <td className="text-secondary">{formatDate(fine.createdAt)}</td>
      <td className="text-strong">{formatMoney(fine.amount)}</td>
      <td>
        <Badge tone={state.tone}>{fine.status === "partial" ? `Debe ${formatMoney(owedAmount)}` : state.label}</Badge>
      </td>
      <td>
        <div className="row" style={{ gap: 6 }}>
          {open && <Button size="small" variant="secondary" onClick={onView}>Registrar pago</Button>}
          <ActionMenu label={`Más acciones de ${who}`} actions={[{ label: "Ver detalle", onClick: onView }]} />
        </div>
      </td>
    </tr>
  );
}

function FineCard({ fine, onView }: { fine: FineDTO; onView: () => void }) {
  const state = FINE_STATUS_LABEL[fine.status];
  const open = fine.status === "pending" || fine.status === "partial";
  const match = fine.matchId ? `${fine.matchId.homeTeamId.name} vs ${fine.matchId.awayTeamId.name}` : null;
  const owedAmount = fine.amount - fine.paidAmount;
  const who = fine.playerId?.fullName ?? fine.teamId.name;

  return (
    <div className="list-row" style={{ alignItems: "flex-start", padding: "var(--space-md)" }}>
      <Avatar src={fine.playerId?.photoUrl ?? fine.teamId.shieldUrl} name={who} size={44} square={!fine.playerId} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="champ-caption truncate"><span className="text-strong">{fine.teamId.name}</span></div>
        <div className="champ-name truncate">{who}</div>
        <div className="row-wrap" style={{ gap: 6, marginTop: 4 }}>
          <Badge tone={fineTone(fine.type)}>{CONCEPT_LABEL[fine.type]}</Badge>
          {fine.note && <span className="text-secondary text-small">{fine.note}</span>}
        </div>
        {match && <div className="text-secondary text-small truncate" style={{ marginTop: 2 }}>{match} · {formatDate(fine.createdAt)}</div>}
        {open && <Button size="small" variant="secondary" onClick={onView} style={{ marginTop: 8 }}>Registrar pago</Button>}
      </div>
      <div className="stack-sm" style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <strong style={{ fontSize: 14, color: open ? "var(--color-warning)" : "var(--color-text-primary)" }}>{formatMoney(fine.amount)}</strong>
        <Badge tone={state.tone}>{fine.status === "partial" ? `Debe ${formatMoney(owedAmount)}` : state.label}</Badge>
        <ActionMenu label={`Más acciones de ${who}`} actions={[{ label: "Ver detalle", onClick: onView }]} />
      </div>
    </div>
  );
}

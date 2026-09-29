"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CalendarDays, CalendarPlus, ChevronDown, FilterX, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { FixtureModal } from "@/components/match/FixtureModal";
import { MatchFormModal } from "@/components/match/MatchFormModal";
import { MatchdayScheduleModal } from "@/components/match/MatchdayScheduleModal";
import { MatchList } from "@/components/match/MatchList";
import { Button, EmptyState, ErrorState, Loading, Modal, PageHeader } from "@/components/ui";
import { PLAYED_MATCH_STATUSES, UNPLAYED_MATCH_STATUSES, type MatchStatus } from "@/lib/constants";
import { useRole } from "@/components/layout/RoleContext";
import { championshipPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO, MatchdayDTO, Paginated, PhaseDTO, TeamDTO } from "@/types/api";

export function MatchesView({ initialScheduled }: { initialScheduled?: "true" | "false" }) {
  return <RequireChampionship>{(championship) => <MatchesList championshipId={championship._id} initialScheduled={initialScheduled} />}</RequireChampionship>;
}

type MatchesTab = "results" | "upcoming";
const MATCHES_TABS: { id: MatchesTab; label: string }[] = [
  { id: "results", label: "Resultados de partidos" },
  { id: "upcoming", label: "Próximos partidos" },
];

function MatchesList({ championshipId, initialScheduled }: { championshipId: string; initialScheduled?: "true" | "false" }) {
  // Filters are remembered per championship, so coming back to the list keeps what the organizer was looking at.
  const key = (name: string) => `super-torneos:matches:${championshipId}:${name}`;
  // A "?programacion=" deep link (e.g. from the "Programar" quick action) only makes sense among upcoming
  // matches: it overrides the tab and the "scheduled" filter for this one visit, without becoming the
  // remembered default for future visits (each is consumed the moment the organizer changes it themselves).
  const [storedTab, setStoredTab] = useStoredState<MatchesTab>(key("tab"), "upcoming", (value) => MATCHES_TABS.some((item) => item.id === value));
  const [tabOverrideActive, setTabOverrideActive] = useState(initialScheduled !== undefined);
  const tab = tabOverrideActive && initialScheduled !== undefined ? "upcoming" : storedTab;
  const setTab = (value: MatchesTab) => {
    setTabOverrideActive(false);
    setStoredTab(value);
  };
  const tabStatuses: readonly MatchStatus[] = tab === "results" ? PLAYED_MATCH_STATUSES : UNPLAYED_MATCH_STATUSES;

  const [storedStatus, setStatus] = useStoredState<string>(key("status"), "");
  // A remembered status from the other tab (e.g. "Finalizado" while now viewing "Próximos partidos") doesn't apply here.
  const status = tabStatuses.includes(storedStatus as MatchStatus) ? storedStatus : "";
  const [storedPhaseId, setPhaseId] = useStoredState<string>(key("phase"), "");
  const [storedTeamId, setTeamId] = useStoredState<string>(key("team"), "");
  const [storedMatchdayId, setMatchdayId] = useStoredState<string>(key("matchday"), "");
  const [storedScheduledFilter, setStoredScheduledFilter] = useStoredState<string>(key("scheduled"), "");
  const [scheduledOverrideActive, setScheduledOverrideActive] = useState(initialScheduled !== undefined);
  // Only meaningful among upcoming matches (an already-played match virtually always has a day and time).
  const scheduledFilter = tab !== "upcoming" ? "" : scheduledOverrideActive && initialScheduled !== undefined ? initialScheduled : storedScheduledFilter;
  const setScheduledFilter = (value: string) => {
    setScheduledOverrideActive(false);
    setStoredScheduledFilter(value);
  };
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Calendar-day range ("YYYY-MM-DD", local time).
  const [fromDay, setFromDay] = useStoredState<string>(key("from"), "");
  const [toDay, setToDay] = useStoredState<string>(key("to"), "");
  const phases = useFetch<{ data: PhaseDTO[] }>(`/championships/${championshipId}/phases`);
  const phaseList = phases.data?.data ?? [];
  const teamsFetch = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const teamList = teamsFetch.data?.data ?? [];
  const matchdaysFetch = useFetch<{ data: (MatchdayDTO & { phaseName: string })[] }>(`/championships/${championshipId}/matchdays`);
  const allMatchdays = matchdaysFetch.data?.data ?? [];
  // A remembered phase, team or fecha that no longer exists must not leave the list empty.
  const phaseId = phases.data && storedPhaseId && !phaseList.some((item) => item._id === storedPhaseId) ? "" : storedPhaseId;
  const teamId = teamsFetch.data && storedTeamId && !teamList.some((item) => item._id === storedTeamId) ? "" : storedTeamId;
  const matchdayId = matchdaysFetch.data && storedMatchdayId && !allMatchdays.some((item) => item._id === storedMatchdayId) ? "" : storedMatchdayId;
  const matchdayList = phaseId ? allMatchdays.filter((item) => item.phaseId === phaseId) : allMatchdays;
  const [search, setSearch] = useState("");
  const filtered = Boolean(status || phaseId || teamId || matchdayId || scheduledFilter || fromDay || toDay || search.trim());
  const [formOpen, setFormOpen] = useState(false);
  const [fixtureOpen, setFixtureOpen] = useState(false);
  const query = `/matches?championshipId=${championshipId}&limit=100${status ? `&status=${status}` : `&played=${tab === "results" ? "true" : "false"}`}${phaseId ? `&phaseId=${phaseId}` : ""}${teamId ? `&teamId=${teamId}` : ""}${matchdayId ? `&matchdayId=${matchdayId}` : ""}${scheduledFilter ? `&scheduled=${scheduledFilter}` : ""}${fromDay ? `&from=${encodeURIComponent(new Date(`${fromDay}T00:00:00`).toISOString())}` : ""}${toDay ? `&to=${encodeURIComponent(new Date(`${toDay}T23:59:59.999`).toISOString())}` : ""}`;
  const { data, error, loading, reload } = useFetch<Paginated<MatchDTO>>(query);
  const searched = (data?.data ?? []).filter((match) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return match.homeTeamId.name.toLowerCase().includes(q) || match.awayTeamId.name.toLowerCase().includes(q) || match.venue.toLowerCase().includes(q);
  });
  // Results read best most-recent-first; upcoming matches follow the tournament's own phase/fecha order.
  const matches = tab === "results"
    ? [...searched].sort((a, b) => new Date(b.scheduledAt ?? 0).getTime() - new Date(a.scheduledAt ?? 0).getTime())
    : searched;
  const clearFilters = () => { setStatus(""); setPhaseId(""); setTeamId(""); setMatchdayId(""); setScheduledFilter(""); setFromDay(""); setToDay(""); setSearch(""); };
  const { can } = useRole();
  const manage = can("match.manage");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const statusSelect = (
    <select className="select" aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)}>
      <option value="">Todos los estados</option>
      {tabStatuses.map((item) => <option key={item} value={item}>{MATCH_STATUS_LABEL[item].label}</option>)}
    </select>
  );
  // Styled as plain text + a chevron (not a boxed dropdown): the phase this championship is in, tap to change.
  const phasePicker = phaseList.length > 0 && (
    <div className="dropdown-picker">
      <select className="dropdown-picker-select" aria-label="Filtrar por fase" value={phaseId} onChange={(e) => { setPhaseId(e.target.value); setMatchdayId(""); }}>
        <option value="">Todas las fases</option>
        {phaseList.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select>
      <ChevronDown size={18} aria-hidden />
    </div>
  );
  // Same look as the phase picker: which team's matches to show (home or away).
  const teamPicker = teamList.length > 0 && (
    <div className="dropdown-picker">
      <select className="dropdown-picker-select" aria-label="Filtrar por equipo" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">Todos los equipos</option>
        {teamList.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select>
      <ChevronDown size={18} aria-hidden />
    </div>
  );
  // One pill per fecha (scrollable row), "Todas" first; the fechas shown follow the phase picked above.
  const fechaTabs = allMatchdays.length > 0 && (
    <div className="fecha-tabs" role="tablist" aria-label="Fecha">
      <button type="button" role="tab" aria-selected={matchdayId === ""} className={`fecha-tab${matchdayId === "" ? " active" : ""}`} onClick={() => setMatchdayId("")}>
        Todas
      </button>
      {matchdayList.map((item) => (
        <button
          key={item._id}
          type="button"
          role="tab"
          aria-selected={matchdayId === item._id}
          className={`fecha-tab${matchdayId === item._id ? " active" : ""}`}
          onClick={() => setMatchdayId(item._id)}
        >
          {item.name} <span className="fecha-tab-badge">{item.matches.total}</span>
        </button>
      ))}
    </div>
  );
  const scheduledSelect = (
    <select className="select" aria-label="Filtrar por programación" value={scheduledFilter} onChange={(e) => setScheduledFilter(e.target.value)}>
      <option value="">Con o sin día y hora</option>
      <option value="false">Sin día ni hora</option>
      <option value="true">Con día y hora</option>
    </select>
  );
  const fromInput = <input id="from-day" className="input" type="date" aria-label="Desde el día" value={fromDay} max={toDay || undefined} onChange={(e) => setFromDay(e.target.value)} />;
  const toInput = <input id="to-day" className="input" type="date" aria-label="Hasta el día" value={toDay} min={fromDay || undefined} onChange={(e) => setToDay(e.target.value)} />;
  const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });
  // Active filters as removable chips (the phase, team and fecha have their own always-visible pickers, so they're not repeated here).
  const chips = [
    status && { label: MATCH_STATUS_LABEL[status as MatchStatus].label, clear: () => setStatus("") },
    scheduledFilter && { label: scheduledFilter === "true" ? "Con día y hora" : "Sin día ni hora", clear: () => setScheduledFilter("") },
    fromDay && { label: `Desde ${dayLabel(fromDay)}`, clear: () => setFromDay("") },
    toDay && { label: `Hasta ${dayLabel(toDay)}`, clear: () => setToDay("") },
  ].filter((chip): chip is { label: string; clear: () => void } => Boolean(chip));
  const extraActive = chips.length;

  return (
    <>
      <PageHeader
        title="Partidos"
        description="Programación, asistencia y eventos de cada encuentro."
        actions={manage && (
          <>
            <Button variant="secondary" icon={<CalendarPlus size={18} />} disabled={phaseList.length === 0} onClick={() => setFixtureOpen(true)}>Generar calendario</Button>
            <Button icon={<Plus size={18} />} disabled={phaseList.length === 0} onClick={() => setFormOpen(true)}>Nuevo partido</Button>
          </>
        )}
        mobileActions={manage ? [
          { label: "Nuevo partido", icon: <Plus size={20} />, disabled: phaseList.length === 0, onClick: () => setFormOpen(true) },
          { label: "Generar calendario", icon: <CalendarPlus size={20} />, disabled: phaseList.length === 0, onClick: () => setFixtureOpen(true) },
        ] : undefined}
      />

      {manage && phases.data && phaseList.length === 0 && (
        <div className="alert warning" role="note" style={{ marginBottom: "var(--space-lg)" }}>
          <span className="grow">Todo partido pertenece a una fase de un torneo. Crea primero una fase (liga, grupos o eliminatoria) para poder programar partidos.</span>
          <Link href={championshipPath(championshipId, "gestionar")} className="btn secondary small">Configurar fases</Link>
        </div>
      )}

      <div className="tabs-line" role="tablist" aria-label="Tipo de partidos">
        {MATCHES_TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="stack-sm" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="row-between">
          <div className="row-wrap" style={{ columnGap: "var(--space-lg)", rowGap: 0 }}>
            {phasePicker}
            {teamPicker}
          </div>
          <Button variant="secondary" icon={<SlidersHorizontal size={18} />} onClick={() => setFiltersOpen(true)}>
            Filtros{extraActive > 0 ? ` (${extraActive})` : ""}
          </Button>
        </div>
        <div className="search" style={{ maxWidth: 420 }}>
          <Search size={18} aria-hidden />
          <input className="input" type="search" placeholder="Buscar equipo o cancha..." aria-label="Buscar equipo o cancha" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {fechaTabs}
        {(filtered || matchdayId) && (
          <div className="chips">
            {chips.map((chip) => (
              <span key={chip.label} className="chip">
                {chip.label}
                <button aria-label={`Quitar filtro ${chip.label}`} onClick={chip.clear}><X size={14} aria-hidden /></button>
              </span>
            ))}
            {manage && matchdayId && tab === "upcoming" && (
              <Button variant="secondary" size="small" icon={<CalendarClock size={16} />} onClick={() => setScheduleOpen(true)}>Programar esta fecha</Button>
            )}
            {filtered && (
              <Button variant="ghost" size="small" icon={<FilterX size={16} />} onClick={clearFilters}>Limpiar filtros</Button>
            )}
          </div>
        )}
      </div>

      <Modal
        open={filtersOpen}
        title="Filtros"
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={clearFilters} disabled={!filtered}>Limpiar</Button>
            <Button onClick={() => setFiltersOpen(false)}>Ver {matches.length} {matches.length === 1 ? "partido" : "partidos"}</Button>
          </>
        }
      >
        <div className="stack">
          {statusSelect}
          {tab === "upcoming" && scheduledSelect}
          <div className="form-grid two">
            <div className="field"><label htmlFor="from-day">Desde</label>{fromInput}</div>
            <div className="field"><label htmlFor="to-day">Hasta</label>{toInput}</div>
          </div>
        </div>
      </Modal>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : matches.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CalendarDays size={28} />}
            title={filtered ? "Sin resultados" : tab === "results" ? "Aún no hay resultados" : "Aún no hay partidos programados"}
            description={
              filtered
                ? "No hay partidos con esos filtros."
                : tab === "results"
                  ? "Aquí aparecerán los partidos finalizados."
                  : "Programa el primer partido del torneo."
            }
            action={manage && !filtered && tab === "upcoming" && phaseList.length > 0 && (
              <div className="row-wrap" style={{ justifyContent: "center" }}>
                <Button onClick={() => setFixtureOpen(true)}>Generar calendario</Button>
                <Button variant="secondary" onClick={() => setFormOpen(true)}>Crear partido</Button>
              </div>
            )}
          />
        </div>
      ) : (
        <MatchList matches={matches} />
      )}

      {scheduleOpen && matchdayId && (
        <MatchdayScheduleModal
          open
          matchday={{ _id: matchdayId, name: allMatchdays.find((item) => item._id === matchdayId)?.name ?? "Fecha" }}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => {
            setScheduleOpen(false);
            reload();
            matchdaysFetch.reload();
          }}
        />
      )}
      <FixtureModal
        open={fixtureOpen}
        championshipId={championshipId}
        phases={phaseList}
        onClose={() => setFixtureOpen(false)}
        onCreated={() => {
          setFixtureOpen(false);
          reload();
          matchdaysFetch.reload();
        }}
      />
      <MatchFormModal
        open={formOpen}
        championshipId={championshipId}
        phases={phaseList}
        match={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
          matchdaysFetch.reload();
        }}
      />
    </>
  );
}

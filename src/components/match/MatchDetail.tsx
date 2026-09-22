"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { AttendancePanel } from "@/components/attendance/AttendancePanel";
import { MatchFormModal } from "@/components/match/MatchFormModal";
import { EventComposerModal, type PresentPlayer } from "@/components/match/EventComposerModal";
import { EventTimeline } from "@/components/match/EventTimeline";
import { MatchClock } from "@/components/match/MatchClock";
import { MatchQuickStatus } from "@/components/match/MatchQuickStatus";
import { MatchRoster } from "@/components/match/MatchRoster";
import { MatchScoreboard } from "@/components/match/MatchScoreboard";
import { MatchSummary } from "@/components/match/MatchSummary";
import { ActionMenu, ConfirmDialog, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import type { MatchEventType } from "@/lib/constants";
import { championshipPath } from "@/lib/paths";
import { errorMessage, http } from "@/lib/client/http";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { suggestedMinute } from "@/lib/rules/match";
import type { AttendanceDTO, ChampionshipDTO, MatchDTO, MatchEventDTO, Paginated, PhaseDTO, SuspensionDTO } from "@/types/api";

export type MatchTab = "attendance" | "events" | "summary";
const TABS: { id: MatchTab; label: string }[] = [
  { id: "attendance", label: "Asistencia" },
  { id: "events", label: "Eventos" },
  { id: "summary", label: "Resumen" },
];

export function MatchDetail({ id, initialTab }: { id: string; initialTab?: MatchTab }) {
  const router = useRouter();
  const toast = useToast();
  const match = useFetch<MatchDTO>(`/matches/${id}`);
  const events = useFetch<{ data: MatchEventDTO[] }>(`/matches/${id}/events`);
  const attendance = useFetch<AttendanceDTO>(`/matches/${id}/attendance`);
  const suspensions = useFetch<Paginated<SuspensionDTO>>(`/suspensions?matchId=${id}&limit=50`);
  const phases = useFetch<{ data: PhaseDTO[] }>(match.data ? `/championships/${match.data.championshipId}/phases` : null);
  const championship = useFetch<ChampionshipDTO>(match.data ? `/championships/${match.data.championshipId}` : null);
  const { can } = useRole();
  const manage = can("match.manage");
  const operate = can("match.operate");
  const [tab, setTab] = useState<MatchTab | null>(initialTab ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [composer, setComposer] = useState<{ type: MatchEventType; minute: number } | null>(null);

  if (match.error) return <ErrorState message={match.error.message} onRetry={match.reload} />;
  if (!match.data) return <Loading />;
  const current = match.data;

  const inPlay = current.status === "live" || current.status === "finished";
  const tabs = operate ? TABS : TABS.filter((item) => item.id !== "attendance");
  const requested = tab ?? (inPlay ? "events" : operate ? "attendance" : "summary");
  const activeTab = tabs.some((item) => item.id === requested) ? requested : tabs[0].id;

  const teams: [MatchDTO["homeTeamId"], MatchDTO["awayTeamId"]] = [current.homeTeamId, current.awayTeamId];
  const teamNames = Object.fromEntries(teams.map((team) => [team._id, team.name]));
  const eventList = events.data?.data ?? [];
  const rows = attendance.data?.checkIns ?? [];
  // The whole called-up roster, not just checked-in players: tagging a goal or card never
  // requires attendance to be confirmed first (many amateur matches don't track it strictly).
  const presentPlayers: PresentPlayer[] = rows
    .map((row) => ({ playerId: row.playerId._id, teamId: row.teamId, fullName: row.playerId.fullName, shirtNumber: row.shirtNumber, status: row.status }));
  const shirtByPlayer = Object.fromEntries(rows.map((row) => [row.playerId._id, row.shirtNumber]));
  const sentOff = new Set(eventList.filter((event) => event.type === "red_card" && !event.voided && event.playerId).map((event) => event.playerId!._id));

  const reloadAll = () => {
    match.reload();
    events.reload();
    attendance.reload();
    suspensions.reload();
  };

  async function handleDelete() {
    setDeleting(true);
    try {
      await http(`/matches/${id}`, { method: "DELETE" });
      toast.success("Partido eliminado");
      router.push(championshipPath(current.championshipId, "partidos"));
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const openComposer = (type: MatchEventType) =>
    setComposer({ type, minute: suggestedMinute(current.period, current.periodStartedAt) });

  return (
    <>
      <PageHeader
        title={`${current.homeTeamId.name} vs ${current.awayTeamId.name}`}
        breadcrumb={[{ label: "Partidos", href: championshipPath(current.championshipId, "partidos") }, { label: `${current.homeTeamId.name} vs ${current.awayTeamId.name}` }]}
        actions={manage && (
          <ActionMenu
            label="Más acciones del partido"
            actions={[
              { label: "Editar partido", icon: <Pencil size={18} />, onClick: () => setEditOpen(true) },
              { label: "Eliminar partido", icon: <Trash2 size={18} />, danger: true, onClick: () => setDeleteOpen(true) },
            ]}
          />
        )}
      />

      <div style={{ marginBottom: "var(--space-2xl)" }}>
        <MatchScoreboard match={current} />
      </div>

      {operate && <MatchClock periodLabels={championship.data?.rules.periodLabels ?? ["1er Tiempo", "2do Tiempo"]} />}
      {operate && (
        <div style={{ marginBottom: "var(--space-2xl)", maxWidth: 420 }}>
          <MatchQuickStatus match={current} onChanged={reloadAll} />
        </div>
      )}

      <div className="tabs-line" role="tablist" aria-label="Secciones del partido">
        {tabs.map((item) => (
          <button key={item.id} role="tab" aria-selected={activeTab === item.id} className={`tab-line${activeTab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === "attendance" &&
        (attendance.error ? (
          <ErrorState message={attendance.error.message} onRetry={attendance.reload} />
        ) : !attendance.data ? (
          <Loading />
        ) : (
          <AttendancePanel matchId={id} match={current} attendance={attendance.data} onChanged={reloadAll} readOnly={!operate} />
        ))}

      {activeTab === "events" && (
        <div className="stack" style={{ gap: "var(--space-2xl)" }}>
          {operate && inPlay && (
            <MatchRoster match={current} events={eventList} players={presentPlayers} sentOff={sentOff} onChanged={reloadAll} onOther={openComposer} onGoToAttendance={() => setTab("attendance")} />
          )}
          {operate && inPlay && current.status === "finished" && (
            <p className="text-secondary text-small">El partido finalizó: registrar o anular eventos corrige el marcador y la disciplina.</p>
          )}

          <section aria-label="Cronología">
            <div className="flush-list">
              <h2 className="band band-muted band-small">Cronología</h2>
              {events.error ? (
                <ErrorState message={events.error.message} onRetry={events.reload} />
              ) : !events.data ? (
                <Loading />
              ) : (
                <EventTimeline matchId={id} events={eventList} teamNames={teamNames} shirtByPlayer={shirtByPlayer} canVoid={inPlay && operate} onChanged={reloadAll} />
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "summary" && (
        <MatchSummary events={eventList} teams={teams} suspensions={suspensions.data?.data ?? []} shirtByPlayer={shirtByPlayer} />
      )}

      {composer && (
        <EventComposerModal
          open
          matchId={id}
          teams={teams}
          players={presentPlayers}
          sentOff={sentOff}
          initialType={composer.type}
          defaultMinute={composer.minute}
          onClose={() => setComposer(null)}
          onSaved={() => {
            setComposer(null);
            reloadAll();
          }}
        />
      )}
      <MatchFormModal
        open={editOpen}
        championshipId={current.championshipId}
        phases={phases.data?.data ?? []}
        match={current}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          match.reload();
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar partido"
        message="Solo es posible si el partido está programado y sin asistencia registrada."
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

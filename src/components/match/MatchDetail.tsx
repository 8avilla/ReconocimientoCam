"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { AttendancePanel } from "@/components/attendance/AttendancePanel";
import { MatchFormModal } from "@/components/match/MatchFormModal";
import { EventComposerModal, type PresentPlayer } from "@/components/match/EventComposerModal";
import { EventIcon } from "@/components/match/EventIcon";
import { EventTimeline } from "@/components/match/EventTimeline";
import { MatchControls } from "@/components/match/MatchControls";
import { MatchScoreboard } from "@/components/match/MatchScoreboard";
import { MatchSummary } from "@/components/match/MatchSummary";
import { Button, ConfirmDialog, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import type { MatchEventType } from "@/lib/constants";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { EVENT_TYPE_LABEL } from "@/lib/labels";
import { suggestedMinute } from "@/lib/rules/match";
import type { AttendanceDTO, MatchDTO, MatchEventDTO, Paginated, SuspensionDTO } from "@/types/api";

export type MatchTab = "attendance" | "events" | "summary";
const TABS: { id: MatchTab; label: string }[] = [
  { id: "attendance", label: "Asistencia" },
  { id: "events", label: "Eventos" },
  { id: "summary", label: "Resumen" },
];
const QUICK_EVENTS: MatchEventType[] = ["goal", "yellow_card", "red_card", "substitution"];

export function MatchDetail({ id, initialTab }: { id: string; initialTab?: MatchTab }) {
  const router = useRouter();
  const toast = useToast();
  const match = useFetch<MatchDTO>(`/matches/${id}`);
  const events = useFetch<{ data: MatchEventDTO[] }>(`/matches/${id}/events`);
  const attendance = useFetch<AttendanceDTO>(`/matches/${id}/attendance`);
  const suspensions = useFetch<Paginated<SuspensionDTO>>(`/suspensions?matchId=${id}&limit=50`);
  const [tab, setTab] = useState<MatchTab | null>(initialTab ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [composer, setComposer] = useState<{ type: MatchEventType; minute: number } | null>(null);

  if (match.error) return <ErrorState message={match.error.message} onRetry={match.reload} />;
  if (!match.data) return <Loading />;
  const current = match.data;

  const inPlay = current.status === "live" || current.status === "finished";
  const activeTab = tab ?? (inPlay ? "events" : "attendance");

  const teams: [MatchDTO["homeTeamId"], MatchDTO["awayTeamId"]] = [current.homeTeamId, current.awayTeamId];
  const teamNames = Object.fromEntries(teams.map((team) => [team._id, team.name]));
  const eventList = events.data?.data ?? [];
  const rows = attendance.data?.checkIns ?? [];
  const presentPlayers: PresentPlayer[] = rows
    .filter((row) => row.status === "present")
    .map((row) => ({ playerId: row.playerId._id, teamId: row.teamId, fullName: row.playerId.fullName, shirtNumber: row.shirtNumber }));
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
      router.push("/matches");
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
        breadcrumb={[{ label: "Partidos", href: "/matches" }, { label: `${current.homeTeamId.name} vs ${current.awayTeamId.name}` }]}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil size={18} />} onClick={() => setEditOpen(true)}>Editar</Button>
            <Button variant="ghost" icon={<Trash2 size={18} />} onClick={() => setDeleteOpen(true)} aria-label="Eliminar partido" />
          </>
        }
      />

      <div style={{ marginBottom: "var(--space-2xl)" }}>
        <MatchScoreboard match={current} />
      </div>

      <div className="row-wrap" role="tablist" aria-label="Secciones del partido" style={{ marginBottom: "var(--space-lg)" }}>
        {TABS.map((item) => (
          <Button key={item.id} role="tab" aria-selected={activeTab === item.id} variant={activeTab === item.id ? "primary" : "secondary"} onClick={() => setTab(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>

      {activeTab === "attendance" &&
        (attendance.error ? (
          <ErrorState message={attendance.error.message} onRetry={attendance.reload} />
        ) : !attendance.data ? (
          <Loading />
        ) : (
          <AttendancePanel matchId={id} match={current} attendance={attendance.data} onChanged={reloadAll} />
        ))}

      {activeTab === "events" && (
        <div className="stack" style={{ gap: "var(--space-2xl)" }}>
          <MatchControls match={current} onChanged={reloadAll} />

          {inPlay && (
            <section className="stack" aria-label="Registrar evento">
              <h2>Registrar evento</h2>
              <div className="row-wrap">
                {QUICK_EVENTS.map((type) => (
                  <Button key={type} size="large" variant="secondary" icon={<EventIcon type={type} />} onClick={() => openComposer(type)}>
                    {EVENT_TYPE_LABEL[type]}
                  </Button>
                ))}
                <Button size="large" variant="ghost" onClick={() => openComposer("incident")}>Otro evento</Button>
              </div>
              {current.status === "finished" && (
                <p className="text-secondary text-small">El partido finalizó: registrar o anular eventos corrige el marcador y la disciplina.</p>
              )}
            </section>
          )}

          <section aria-label="Cronología">
            <h2 style={{ marginBottom: "var(--space-md)" }}>Cronología</h2>
            <div className="card flush">
              {events.error ? (
                <ErrorState message={events.error.message} onRetry={events.reload} />
              ) : !events.data ? (
                <Loading />
              ) : (
                <EventTimeline matchId={id} events={eventList} teamNames={teamNames} shirtByPlayer={shirtByPlayer} canVoid={inPlay} onChanged={reloadAll} />
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "summary" && <MatchSummary events={eventList} teams={teams} suspensions={suspensions.data?.data ?? []} />}

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

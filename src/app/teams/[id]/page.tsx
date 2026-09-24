"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Star, Trash2, UserPlus } from "lucide-react";
import { PlayerFormModal } from "@/components/player/PlayerFormModal";
import { TeamMatchesTab } from "@/components/team/TeamMatchesTab";
import { TeamRosterTab } from "@/components/team/TeamRosterTab";
import { TeamStatsTab } from "@/components/team/TeamStatsTab";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { ActionMenu, Avatar, Badge, ConfirmDialog, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { FAVORITE_TEAMS_KEY, useFavoriteSet } from "@/lib/client/favorites";
import { useRole } from "@/components/layout/RoleContext";
import { championshipPath } from "@/lib/paths";
import { canAccess } from "@/lib/roles";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import type { RosterEntryDTO, TeamDTO } from "@/types/api";

type TeamTab = "results" | "fixtures" | "stats" | "roster";
const TABS: { id: TeamTab; label: string }[] = [
  { id: "results", label: "Resultados" },
  { id: "fixtures", label: "Partidos" },
  { id: "stats", label: "Estadísticas" },
  { id: "roster", label: "Plantilla" },
];

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const team = useFetch<TeamDTO>(`/teams/${id}`);
  const roster = useFetch<{ data: RosterEntryDTO[] }>(`/teams/${id}/roster`);
  const { can, role } = useRole();
  const [favoriteTeams, toggleFavoriteTeam] = useFavoriteSet(FAVORITE_TEAMS_KEY);
  const [tab, setTab] = useStoredState<TeamTab>("super-torneos:team:tab", "results", (value) => TABS.some((item) => item.id === value));
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expressEditEntry, setExpressEditEntry] = useState<RosterEntryDTO | null>(null);

  if (team.error) return <ErrorState message={team.error.message} onRetry={team.reload} />;
  if (!team.data) return <Loading />;
  const current = team.data;
  const entries = roster.data?.data ?? [];

  async function handleDelete() {
    setDeleting(true);
    try {
      await http(`/teams/${id}`, { method: "DELETE" });
      toast.success("Equipo eliminado");
      router.push(championshipPath(current.championshipId, "equipos"));
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const reloadAll = () => {
    team.reload();
    roster.reload();
  };

  return (
    <>
      <PageHeader
        title={current.name}
        breadcrumb={[{ label: "Equipos", href: championshipPath(current.championshipId, "equipos") }, { label: current.name }]}
        actions={
          <>
            {can("roster.manage") && <Link href={`/players/new?teamId=${id}`} className="btn primary"><UserPlus size={18} aria-hidden /> Agregar jugador</Link>}
            {can("team.manage") && <ActionMenu
              label="Más acciones del equipo"
              actions={[
                { label: "Editar equipo", icon: <Pencil size={18} />, onClick: () => setEditOpen(true) },
                { label: "Eliminar equipo", icon: <Trash2 size={18} />, danger: true, onClick: () => setDeleteOpen(true) },
              ]}
            />}
          </>
        }
      />

      <section className="team-hero">
        <Avatar src={current.shieldUrl} name={current.name} size={72} square />
        <div className="stack-sm grow" style={{ minWidth: 0 }}>
          <div className="row-between">
            <h2>{current.name}</h2>
            <button className={`star-button${favoriteTeams.has(id) ? " on" : ""}`} aria-pressed={favoriteTeams.has(id)} aria-label={favoriteTeams.has(id) ? "Dejar de seguir este equipo" : "Seguir este equipo"} onClick={() => { toggleFavoriteTeam(id); toast.success(favoriteTeams.has(id) ? `Dejaste de seguir ${current.name}` : `Ahora sigues ${current.name}`); }}>
              <Star size={22} fill={favoriteTeams.has(id) ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="row-wrap" style={{ gap: 8 }}>
            <span className="text-secondary">{current.playerCount ?? 0} jugadores</span>
            {!current.active && <Badge tone="neutral">Inactivo</Badge>}
          </div>
          <span className="text-secondary text-small">Delegado: {current.delegateName || "Sin asignar"}</span>
        </div>
      </section>

      <div className="tabs-line" role="tablist" aria-label="Secciones del equipo">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "results" && <TeamMatchesTab teamId={id} championshipId={current.championshipId} kind="results" />}
      {tab === "fixtures" && <TeamMatchesTab teamId={id} championshipId={current.championshipId} kind="fixtures" />}
      {tab === "stats" && <TeamStatsTab teamId={id} championshipId={current.championshipId} />}
      {tab === "roster" && (
        <TeamRosterTab
          teamId={id}
          entries={entries}
          loading={roster.loading}
          error={roster.error}
          onRetry={roster.reload}
          onExpressEdit={can("player.manage") ? setExpressEditEntry : undefined}
          linkPlayers={canAccess(role, "/players/x")}
        />
      )}

      <TeamFormModal
        open={editOpen}
        championshipId={current.championshipId}
        team={current}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          reloadAll();
        }}
      />
      {expressEditEntry && (
        <PlayerFormModal
          open
          player={expressEditEntry.playerId}
          registration={expressEditEntry}
          onClose={() => setExpressEditEntry(null)}
          onSaved={() => {
            setExpressEditEntry(null);
            reloadAll();
          }}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar equipo"
        message={`¿Eliminar "${current.name}"? Si tiene jugadores o partidos, desactívalo en lugar de eliminarlo.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

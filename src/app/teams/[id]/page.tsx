"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ListPlus, Pencil, Star, Trash2, UserPlus } from "lucide-react";
import { TeamMatchesTab } from "@/components/team/TeamMatchesTab";
import { TeamRosterTab } from "@/components/team/TeamRosterTab";
import { TeamStaffBlock } from "@/components/team/TeamStaffBlock";
import { TeamStatsTab } from "@/components/team/TeamStatsTab";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { PlayersBulkModal } from "@/components/player/PlayersBulkModal";
import { ActionMenu, Avatar, Badge, Button, ConfirmDialog, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { FAVORITE_TEAMS_KEY, useFavoriteSet } from "@/lib/client/favorites";
import { useSyncChampionship } from "@/components/layout/ChampionshipContext";
import { useRole } from "@/components/layout/RoleContext";
import { championshipPath, newPlayerPath } from "@/lib/paths";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import type { RosterEntryDTO, TeamDTO } from "@/types/api";

type TeamTab = "results" | "fixtures" | "stats" | "roster";
const TABS: { id: TeamTab; label: string }[] = [
  { id: "roster", label: "Plantilla" },
  { id: "results", label: "Resultados" },
  { id: "fixtures", label: "Próximos" },
  { id: "stats", label: "Estadísticas" },
];

type RosterSubTab = "players" | "staff";
const ROSTER_SUB_TABS: { id: RosterSubTab; label: string }[] = [
  { id: "players", label: "Jugadores" },
  { id: "staff", label: "Cuerpo técnico" },
];

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const team = useFetch<TeamDTO>(`/teams/${id}`);
  useSyncChampionship(team.data?.championshipId);
  const roster = useFetch<{ data: RosterEntryDTO[] }>(`/teams/${id}/roster`);
  const { can } = useRole();
  const [favoriteTeams, toggleFavoriteTeam] = useFavoriteSet(FAVORITE_TEAMS_KEY);
  const [tab, setTab] = useState<TeamTab>("roster");
  const [rosterTab, setRosterTab] = useStoredState<RosterSubTab>("super-torneos:team:rosterTab", "players", (value) => ROSTER_SUB_TABS.some((item) => item.id === value));
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        // On phones the buttons become the floating "+" sheet, so the title keeps the full width.
        mobileActions={[
          ...(can("roster.manage") ? [{ label: "Agregar jugador", icon: <UserPlus size={20} />, href: newPlayerPath(current.championshipId, id) }, { label: "Agregar varios jugadores", icon: <ListPlus size={20} />, onClick: () => setBulkOpen(true) }] : []),
          ...(can("team.manage")
            ? [
                { label: "Editar equipo", icon: <Pencil size={20} />, onClick: () => setEditOpen(true) },
                { label: "Eliminar equipo", icon: <Trash2 size={20} />, danger: true, onClick: () => setDeleteOpen(true) },
              ]
            : []),
        ]}
        actions={
          <>
            {can("roster.manage") && <Button variant="secondary" icon={<ListPlus size={18} />} onClick={() => setBulkOpen(true)}>Agregar varios</Button>}
            {can("roster.manage") && <Link href={newPlayerPath(current.championshipId, id)} className="btn primary"><UserPlus size={18} aria-hidden /> Agregar jugador</Link>}
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

      <section className="team-hero-card" aria-label={`Ficha de ${current.name}`}>
        <div className="team-hero-cover">
          <div className="team-hero-cover-pattern" />
        </div>

        <div className="team-hero-body">
          <div className="team-shield-box">
            <Avatar src={current.shieldUrl} name={current.name} size={84} square />
          </div>

          <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 4 }}>
            <h2 style={{ fontSize: 24 }}>{current.name}</h2>
            <button
              className={`star-button${favoriteTeams.has(id) ? " on" : ""}`}
              aria-pressed={favoriteTeams.has(id)}
              aria-label={favoriteTeams.has(id) ? "Dejar de seguir este equipo" : "Seguir este equipo"}
              onClick={() => {
                toggleFavoriteTeam(id);
                toast.success(favoriteTeams.has(id) ? `Dejaste de seguir ${current.name}` : `Ahora sigues ${current.name}`);
              }}
            >
              <Star size={22} fill={favoriteTeams.has(id) ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="row-wrap" style={{ justifyContent: "center", gap: 12, marginTop: 6 }}>
            <span className="text-secondary" style={{ fontWeight: 400 }}>
              {current.playerCount ?? 0} jugadores inscritos
            </span>
            {!current.active && <Badge tone="neutral">Inactivo</Badge>}
            {current.delegateName && (
              <span className="text-secondary text-small">
                Delegado: <strong>{current.delegateName}</strong>
              </span>
            )}
          </div>
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
        <>
          <div className="filter-chips" role="tablist" aria-label="Tipo de plantilla">
            {ROSTER_SUB_TABS.map((item) => (
              <button key={item.id} role="tab" aria-selected={rosterTab === item.id} className={`filter-chip${rosterTab === item.id ? " active" : ""}`} onClick={() => setRosterTab(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          {rosterTab === "staff" ? (
            <TeamStaffBlock teamId={id} staff={current.staff} canManage={can("team.manage")} onChanged={team.reload} />
          ) : (
            <TeamRosterTab
              teamId={id}
              entries={entries}
              loading={roster.loading}
              error={roster.error}
              onRetry={roster.reload}
              canAddPlayer={can("player.manage")}
              newPlayerHref={newPlayerPath(current.championshipId, id)}
              onBulk={() => setBulkOpen(true)}
              onChanged={roster.reload}
            />
          )}
        </>
      )}

      <PlayersBulkModal
        open={bulkOpen}
        championshipId={current.championshipId}
        teamId={id}
        onClose={() => setBulkOpen(false)}
        onCreated={() => {
          setBulkOpen(false);
          reloadAll();
        }}
      />
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

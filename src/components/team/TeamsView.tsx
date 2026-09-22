"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search, Shield, Star } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { Avatar, Badge, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { FAVORITE_TEAMS_KEY, useFavoriteSet } from "@/lib/client/favorites";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import type { Paginated, TeamDTO } from "@/types/api";

export function TeamsView() {
  return <RequireChampionship>{(championship) => <TeamsList championshipId={championship._id} />}</RequireChampionship>;
}

function TeamsList({ championshipId }: { championshipId: string }) {
  const { data, error, loading, reload } = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const [favoriteTeams, toggleFavoriteTeam] = useFavoriteSet(FAVORITE_TEAMS_KEY);
  const { can } = useRole();
  const manage = can("team.manage");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const teams = (data?.data ?? []).filter((team) => team.name.toLowerCase().includes(search.trim().toLowerCase()));

  const followed = teams.filter((team) => favoriteTeams.has(team._id));
  const others = teams.filter((team) => !favoriteTeams.has(team._id));

  const renderRow = (team: TeamDTO) => {
    const on = favoriteTeams.has(team._id);
    return (
      <div key={team._id} className="list-row team-row">
        <Link href={`/teams/${team._id}`} className="row grow" style={{ minWidth: 0 }}>
          <Avatar src={team.shieldUrl} name={team.name} size={44} square />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="champ-caption truncate">{team.playerCount ?? 0} jugadores</div>
            <div className="champ-name truncate">{team.name}</div>
          </div>
        </Link>
        {!team.active && <Badge tone="neutral">Inactivo</Badge>}
        <button className={`star-button${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? `Dejar de seguir ${team.name}` : `Seguir ${team.name}`} onClick={() => toggleFavoriteTeam(team._id)}>
          <Star size={22} fill={on ? "currentColor" : "none"} />
        </button>
        <Link href={`/teams/${team._id}`} aria-label={`Abrir ${team.name}`} tabIndex={-1}><ChevronRight size={20} aria-hidden color="var(--color-text-disabled)" /></Link>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Equipos"
        description="Gestiona los equipos del campeonato."
        actions={manage && <Button icon={<Plus size={18} />} onClick={() => setFormOpen(true)}>Nuevo equipo</Button>}
        mobileActions={manage ? [{ label: "Nuevo equipo", icon: <Plus size={20} />, onClick: () => setFormOpen(true) }] : undefined}
      />

      <div className="search" style={{ marginBottom: "var(--space-lg)", maxWidth: 420 }}>
        <Search size={18} aria-hidden />
        <input className="input" type="search" placeholder="Buscar equipo..." aria-label="Buscar equipo" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={<Shield size={28} />}
          title={search ? "Sin resultados" : "Aún no hay equipos"}
          description={search ? "Prueba con otro nombre." : "Registra el primer equipo de este campeonato."}
          action={manage && !search && <Button onClick={() => setFormOpen(true)}>Crear equipo</Button>}
        />
      ) : (
        <div className="flush-list">
          {followed.length > 0 && (
            <section aria-label="Equipos que sigues">
              <h2 className="band band-favorite band-small">Equipos que sigues ({followed.length})</h2>
              {followed.map(renderRow)}
            </section>
          )}
          {others.length > 0 && (
            <section aria-label="Equipos">
              <h2 className="band band-muted band-small">{search ? "Resultados" : followed.length > 0 ? "Otros equipos" : "Equipos"} ({others.length})</h2>
              {others.map(renderRow)}
            </section>
          )}
        </div>
      )}

      <TeamFormModal
        open={formOpen}
        championshipId={championshipId}
        team={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </>
  );
}

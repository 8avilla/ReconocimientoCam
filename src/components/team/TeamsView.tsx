"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid, List, Plus, Search, Shield, Star } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { FinesView } from "@/components/sanction/FinesView";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { Avatar, Badge, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { FAVORITE_TEAMS_KEY, useFavoriteSet } from "@/lib/client/favorites";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import type { Paginated, TeamDTO } from "@/types/api";

export function TeamsView() {
  return <RequireChampionship>{(championship) => <TeamsList championshipId={championship._id} />}</RequireChampionship>;
}

function TeamsList({ championshipId }: { championshipId: string }) {
  const { data, error, loading, reload } = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const [favoriteTeams, toggleFavoriteTeam] = useFavoriteSet(FAVORITE_TEAMS_KEY);
  const { can } = useRole();
  const manage = can("team.manage");
  const [storedSection, setSection] = useStoredState<"teams" | "fees">("super-torneos:teams:section", "teams", (value) => value === "teams" || value === "fees");
  const section = manage ? storedSection : "teams";
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const teams = (data?.data ?? []).filter((team) => team.name.toLowerCase().includes(search.trim().toLowerCase()));

  const followed = teams.filter((team) => favoriteTeams.has(team._id));
  const others = teams.filter((team) => !favoriteTeams.has(team._id));

  const renderCard = (team: TeamDTO) => {
    const on = favoriteTeams.has(team._id);
    return (
      <div key={team._id} className="team-card">
        <button
          className={`star-button team-card-star${on ? " on" : ""}`}
          aria-pressed={on}
          aria-label={on ? `Dejar de seguir ${team.name}` : `Seguir ${team.name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavoriteTeam(team._id);
          }}
        >
          <Star size={20} fill={on ? "currentColor" : "none"} />
        </button>

        <Link href={`/teams/${team._id}`} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="team-card-shield">
            <Avatar src={team.shieldUrl} name={team.name} size={64} square />
          </div>
          <div className="team-card-name">{team.name}</div>
          <div className="team-card-meta">{team.playerCount ?? 0} jugadores</div>
          {!team.active && (
            <div style={{ marginTop: 6 }}>
              <Badge tone="neutral">Inactivo</Badge>
            </div>
          )}
        </Link>
      </div>
    );
  };

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
        actions={manage && section === "teams" && <Button icon={<Plus size={18} />} onClick={() => setFormOpen(true)}>Nuevo equipo</Button>}
        mobileActions={manage && section === "teams" ? [{ label: "Nuevo equipo", icon: <Plus size={20} />, onClick: () => setFormOpen(true) }] : undefined}
      />

      {manage && (
        <div className="segmented" role="group" aria-label="Vista de equipos" style={{ marginBottom: "var(--space-lg)" }}>
          <button aria-pressed={section === "teams"} className={section === "teams" ? "active" : ""} onClick={() => setSection("teams")}>Equipos</button>
          <button aria-pressed={section === "fees"} className={section === "fees" ? "active" : ""} onClick={() => setSection("fees")}>Cuotas de inscripción</button>
        </div>
      )}

      {section === "fees" ? (
        <FinesView championshipId={championshipId} type="registration" newOpen={false} onNewClose={() => {}} />
      ) : (
      <>
      {/* Search and View Toggle */}
      <div className="row-between" style={{ marginBottom: "var(--space-lg)", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div className="search grow" style={{ minWidth: 220, maxWidth: 420 }}>
          <Search size={18} aria-hidden />
          <input className="input" type="search" placeholder="Buscar equipo..." aria-label="Buscar equipo" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="view-toggle-bar" style={{ margin: 0 }}>
          <button
            className={`view-toggle-btn${viewMode === "grid" ? " active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Vista de cuadrícula"
          >
            <LayoutGrid size={16} /> Tarjetas
          </button>
          <button
            className={`view-toggle-btn${viewMode === "list" ? " active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Vista de lista"
          >
            <List size={16} /> Lista
          </button>
        </div>
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
      ) : viewMode === "grid" ? (
        <div className="stack" style={{ gap: "var(--space-lg)" }}>
          {followed.length > 0 && (
            <section aria-label="Equipos que sigues">
              <h2 className="band band-favorite band-small" style={{ marginBottom: "var(--space-md)" }}>
                Equipos que sigues ({followed.length})
              </h2>
              <div className="team-cards-grid">
                {followed.map(renderCard)}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section aria-label="Equipos">
              <h2 className="band band-muted band-small" style={{ marginBottom: "var(--space-md)" }}>
                {search ? "Resultados" : followed.length > 0 ? "Otros equipos" : "Equipos"} ({others.length})
              </h2>
              <div className="team-cards-grid">
                {others.map(renderCard)}
              </div>
            </section>
          )}
        </div>
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
      </>
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


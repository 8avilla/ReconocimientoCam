"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid, List, Plus, ScanFace, Search, UserRound, Users, ListPlus } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { PlayersBulkModal } from "@/components/player/PlayersBulkModal";
import { useOpenPlayer } from "@/components/player/PlayerSheetContext";
import { Avatar, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { newPlayerPath } from "@/lib/paths";
import type { Paginated, PlayerDTO, PlayerListDTO, TeamDTO } from "@/types/api";

const PAGE_SIZE = 25;
type FilterMode = "all" | "no_face" | "has_face" | "incomplete";

export function PlayersView() {
  return <RequireChampionship>{(championship) => <PlayersList championshipId={championship._id} />}</RequireChampionship>;
}

function PlayersList({ championshipId }: { championshipId: string }) {
  const { can } = useRole();
  const manage = can("player.manage");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [pages, setPages] = useState(1);
  const [viewMode, setViewMode] = useStoredState<"list" | "grid">("super-torneos:view:players", "list", (value) => value === "list" || value === "grid");
  const openPlayer = useOpenPlayer();
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const params = new URLSearchParams({ championshipId, limit: String(PAGE_SIZE * pages) });
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (teamId) params.set("teamId", teamId);
  if (filterMode !== "all") params.set("filter", filterMode);
  const { data, error, loading, reload } = useFetch<PlayerListDTO>(`/players?${params}`);

  const players = data?.data ?? [];
  const hasMore = data ? data.data.length < data.meta.total : false;
  const filtered = Boolean(debouncedSearch || teamId || filterMode !== "all");

  const counts = data?.counts;
  const displayedPlayers = players;

  return (
    <>
      <PageHeader
        title="Jugadores"
        description="Identidad, foto y estado de los jugadores del torneo."
        actions={manage && (
          <>
            <Button variant="secondary" icon={<ListPlus size={18} />} onClick={() => setBulkOpen(true)}>Agregar varios</Button>
            <Link href={newPlayerPath(championshipId)} className="btn primary"><Plus size={18} aria-hidden /> Nuevo jugador</Link>
          </>
        )}
        mobileActions={manage ? [{ label: "Nuevo jugador", icon: <Plus size={20} />, href: newPlayerPath(championshipId) }, { label: "Agregar varios jugadores", icon: <ListPlus size={20} />, onClick: () => setBulkOpen(true) }] : undefined}
      />

      {/* Search & Team Select Bar */}
      <div className="row-wrap" style={{ marginBottom: "var(--space-md)" }}>
        <div className="search grow" style={{ minWidth: 220, maxWidth: 420 }}>
          <Search size={18} aria-hidden />
          <input
            className="input" type="search" placeholder="Buscar por nombre o documento..." aria-label="Buscar jugador"
            value={search} onChange={(e) => { setSearch(e.target.value); setPages(1); }}
          />
        </div>
        <select
          className="select" style={{ width: "auto", minWidth: 200 }} aria-label="Filtrar por equipo"
          value={teamId} onChange={(e) => { setTeamId(e.target.value); setPages(1); }}
        >
          <option value="">Todos los equipos</option>
          {(teams.data?.data ?? []).map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
        </select>
      </div>

      {/* Quick Filter Chips */}
      {(players.length > 0 || filterMode !== "all") && (
        <div className="filter-chips" style={{ marginBottom: "var(--space-lg)" }}>
          <button className={`filter-chip${filterMode === "all" ? " active" : ""}`} onClick={() => { setFilterMode("all"); setPages(1); }}>
            Todos <span className="filter-chip-badge">{counts?.all ?? "…"}</span>
          </button>
          <button className={`filter-chip${filterMode === "no_face" ? " active" : ""}`} onClick={() => { setFilterMode("no_face"); setPages(1); }}>
            ⚠️ Sin Rostro <span className="filter-chip-badge">{counts?.noFace ?? "…"}</span>
          </button>
          <button className={`filter-chip${filterMode === "has_face" ? " active" : ""}`} onClick={() => { setFilterMode("has_face"); setPages(1); }}>
            ✅ Con Rostro <span className="filter-chip-badge">{counts?.hasFace ?? "…"}</span>
          </button>
          <button className={`filter-chip${filterMode === "incomplete" ? " active" : ""}`} onClick={() => { setFilterMode("incomplete"); setPages(1); }}>
            ⚠️ Datos Incompletos <span className="filter-chip-badge">{counts?.incomplete ?? "…"}</span>
          </button>
        </div>
      )}

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : displayedPlayers.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={28} />}
            title={filtered ? "Sin resultados" : "Aún no hay jugadores"}
            description={filtered ? "Prueba cambiando la búsqueda o los filtros." : "Registra el primer jugador de este torneo."}
            action={manage && !filtered && <Link href={newPlayerPath(championshipId)} className="btn primary">Registrar jugador</Link>}
          />
        </div>
      ) : (
        <>
          <div className="view-toggle-bar">
            <button className={`view-toggle-btn${viewMode === "list" ? " active" : ""}`} onClick={() => setViewMode("list")} title="Vista de lista">
              <List size={16} /> Lista
            </button>
            <button className={`view-toggle-btn${viewMode === "grid" ? " active" : ""}`} onClick={() => setViewMode("grid")} title="Vista de tarjetas">
              <LayoutGrid size={16} /> Tarjetas
            </button>
          </div>
          <div className="flush-list">
            <h2 className="band band-muted band-small">
              Jugadores ({data?.meta.total ?? displayedPlayers.length}{filterMode !== "all" && counts ? ` de ${counts.all}` : ""})
            </h2>
            {viewMode === "grid" ? (
              <div className="roster-card-grid">
                {displayedPlayers.map((player) => (
                  <div key={player._id} className="roster-card">
                    <button type="button" className="row grow" style={{ minWidth: 0, textAlign: "left" }} onClick={() => openPlayer(player._id, reload)}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                        <PlayerPhoto player={player} size={64} style={{ marginBottom: 8 }} />
                        <div className="truncate" style={{ maxWidth: 160, fontSize: 13 }}>{player.fullName}</div>
                        <div className="text-secondary text-small truncate" style={{ maxWidth: 160 }}>{player.registration?.team?.name ?? "Sin equipo"}</div>
                        <div className="stack-sm" style={{ gap: 4, marginTop: 6, alignItems: "center" }}>
                          {player.registration && player.registration.status !== "active" && <RegistrationBadge status={player.registration.status} />}
                          <FaceBadge hasFace={player.hasFace} />
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
            <>
            <div>
              {displayedPlayers.map((player) => (
                <div key={player._id} className="list-row">
                  <button type="button" className="row grow" style={{ minWidth: 0, textAlign: "left" }} onClick={() => openPlayer(player._id, reload)}>
                    <PlayerPhoto player={player} size={44} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="champ-caption truncate">
                        {player.registration?.team?.name ?? "Sin equipo"}
                        {player.registration && ` · ${player.registration.shirtNumber != null ? `#${player.registration.shirtNumber} · ` : ""}${player.registration.position ?? "Sin posición"}`}
                      </div>
                      <div className="champ-name truncate">{player.fullName}</div>
                    </div>
                    {player.registration && player.registration.status !== "active" && <RegistrationBadge status={player.registration.status} />}
                    <span title={player.hasFace ? "Rostro registrado" : "Sin rostro"} aria-label={player.hasFace ? "Rostro registrado" : "Sin rostro"} style={{ display: "inline-flex", color: player.hasFace ? "var(--color-success)" : "var(--color-warning)" }}>
                      {player.hasFace ? <ScanFace size={22} /> : <UserRound size={22} />}
                    </span>
                    <ChevronRight size={20} aria-hidden color="var(--color-text-disabled)" />
                  </button>
                </div>
              ))}
            </div>
            </>
            )}
          </div>
          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-lg)" }}>
              <Button variant="secondary" loading={loading} onClick={() => setPages((current) => current + 1)}>Mostrar más</Button>
            </div>
          )}
        </>
      )}
      <PlayersBulkModal
        open={bulkOpen}
        championshipId={championshipId}
        teamId={teamId}
        onClose={() => setBulkOpen(false)}
        onCreated={() => {
          setBulkOpen(false);
          reload();
        }}
      />
    </>
  );
}


/** Player photo with the shirt number badge, same as in the team roster. */
function PlayerPhoto({ player, size, style }: { player: PlayerDTO; size: number; style?: React.CSSProperties }) {
  const shirtNumber = player.registration?.shirtNumber;
  return (
    <span className="shirt-photo" style={style}>
      <Avatar src={player.photoUrl} name={player.fullName} size={size} />
      {shirtNumber != null && <span className="shirt-number">{shirtNumber}</span>}
    </span>
  );
}

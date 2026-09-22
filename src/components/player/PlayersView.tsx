"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, ScanFace, Search, UserRound, Users } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { Avatar, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import type { Paginated, PlayerDTO, TeamDTO } from "@/types/api";

const PAGE_SIZE = 25;

export function PlayersView() {
  return <RequireChampionship>{(championship) => <PlayersList championshipId={championship._id} />}</RequireChampionship>;
}

function PlayersList({ championshipId }: { championshipId: string }) {
  const { can } = useRole();
  const manage = can("player.manage");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const params = new URLSearchParams({ championshipId, limit: String(PAGE_SIZE * pages) });
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (teamId) params.set("teamId", teamId);
  const { data, error, loading, reload } = useFetch<Paginated<PlayerDTO>>(`/players?${params}`);

  const players = data?.data ?? [];
  const hasMore = data ? data.data.length < data.meta.total : false;
  const filtered = Boolean(debouncedSearch || teamId);

  return (
    <>
      <PageHeader
        title="Jugadores"
        description="Identidad, foto y estado de los jugadores del campeonato."
        actions={manage && <Link href="/players/new" className="btn primary"><Plus size={18} aria-hidden /> Nuevo jugador</Link>}
        mobileActions={manage ? [{ label: "Nuevo jugador", icon: <Plus size={20} />, href: "/players/new" }] : undefined}
      />

      <div className="row-wrap" style={{ marginBottom: "var(--space-lg)" }}>
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

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : players.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={28} />}
            title={filtered ? "Sin resultados" : "Aún no hay jugadores"}
            description={filtered ? "Prueba con otros filtros." : "Registra el primer jugador de este campeonato."}
            action={manage && !filtered && <Link href="/players/new" className="btn primary">Registrar jugador</Link>}
          />
        </div>
      ) : (
        <>
          <div className="flush-list">
            <h2 className="band band-muted band-small">Jugadores ({data?.meta.total ?? players.length})</h2>
            <div className="table-wrap only-desktop">
              <table className="table">
                <thead>
                  <tr><th>Jugador</th><th>Equipo</th><th>Posición</th><th>Estado</th><th>Rostro</th></tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player._id}>
                      <td>
                        <Link href={`/players/${player._id}`} className="row">
                          <Avatar src={player.photoUrl} name={player.fullName} size={40} />
                          <div>
                            <div className="text-strong">{player.fullName}</div>
                            <div className="text-secondary text-small">{player.documentId}</div>
                          </div>
                        </Link>
                      </td>
                      <td>{player.registration?.team?.name ?? "—"}{player.registration && ` · #${player.registration.shirtNumber}`}</td>
                      <td>{player.registration?.position ?? "—"}</td>
                      <td>{player.registration && <RegistrationBadge status={player.registration.status} />}</td>
                      <td><FaceBadge hasFace={player.hasFace} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="only-mobile">
              {players.map((player) => (
                <Link key={player._id} href={`/players/${player._id}`} className="list-row">
                  <Avatar src={player.photoUrl} name={player.fullName} size={44} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="champ-caption truncate">
                      {player.registration?.team?.name ?? "Sin equipo"}
                      {player.registration && ` · #${player.registration.shirtNumber} · ${player.registration.position}`}
                    </div>
                    <div className="champ-name truncate">{player.fullName}</div>
                  </div>
                  {player.registration && player.registration.status !== "active" && <RegistrationBadge status={player.registration.status} />}
                  {/* Icon only on phones so the name keeps its space. */}
                  <span title={player.hasFace ? "Rostro registrado" : "Sin rostro"} aria-label={player.hasFace ? "Rostro registrado" : "Sin rostro"} style={{ display: "inline-flex", color: player.hasFace ? "var(--color-success)" : "var(--color-warning)" }}>
                    {player.hasFace ? <ScanFace size={22} /> : <UserRound size={22} />}
                  </span>
                  <ChevronRight size={20} aria-hidden color="var(--color-text-disabled)" />
                </Link>
              ))}
            </div>
          </div>
          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-lg)" }}>
              <Button variant="secondary" loading={loading} onClick={() => setPages((current) => current + 1)}>Mostrar más</Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

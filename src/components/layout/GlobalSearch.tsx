"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Shield } from "lucide-react";
import { ChampionshipTile } from "@/components/championship/ChampionshipTile";
import { Avatar, Modal } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import { canAccess } from "@/lib/roles";
import { useChampionship } from "./ChampionshipContext";
import { useRole } from "./RoleContext";
import { championshipPath } from "@/lib/paths";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchStatus } from "@/lib/constants";
import type { SearchDTO } from "@/types/api";

/**
 * Search button for the top bar. Inside a championship it finds its teams, players and matches; outside one
 * (e.g. from the `/` championship list) it searches championships by name or season instead.
 */
export function GlobalSearch({ championshipId }: { championshipId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-button topbar-search" aria-label="Buscar" onClick={() => setOpen(true)}>
        <Search size={22} />
      </button>
      {/* Mounted only while open so it starts empty every time. */}
      {open && (championshipId ? <SearchModal championshipId={championshipId} onClose={() => setOpen(false)} /> : <ChampionshipSearchModal onClose={() => setOpen(false)} />)}
    </>
  );
}

/** Outside a championship: filters the followed/organized championships by name or season. */
function ChampionshipSearchModal({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState("");
  const { championships, favoriteIds } = useChampionship();
  const query = term.trim().toLowerCase();
  const matches = query ? championships.filter((item) => `${item.name} ${item.season}`.toLowerCase().includes(query)) : [];

  return (
    <Modal open title="Buscar campeonato" onClose={onClose}>
      <div className="stack">
        <div className="search">
          <Search size={18} aria-hidden />
          <input className="input" type="search" autoFocus placeholder="Nombre o temporada..." aria-label="Buscar campeonato" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        {!query ? (
          <p className="text-secondary text-small">Escribe el nombre o la temporada de un campeonato.</p>
        ) : matches.length === 0 ? (
          <p className="text-secondary">Sin resultados para «{term}».</p>
        ) : (
          <div className="flush-list" style={{ margin: "0 calc(-1 * var(--space-lg))", border: "none" }}>
            {matches.map((item) => (
              <Link key={item._id} href={championshipPath(item._id)} className="list-row" onClick={onClose}>
                <ChampionshipTile logoUrl={item.logoUrl} size={36} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="text-strong truncate">{item.name}{favoriteIds.has(item._id) && " ★"}</div>
                  <div className="text-secondary text-small">Temporada {item.season}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SearchModal({ championshipId, onClose }: { championshipId: string; onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useFetch<SearchDTO>(query.length >= 2 ? `/search?championshipId=${championshipId}&q=${encodeURIComponent(query)}` : null);
  const { role } = useRole();
  const data = results.data && { ...results.data, players: canAccess(role, "/players") ? results.data.players : [] };
  const empty = data && data.teams.length + data.players.length + data.matches.length === 0;

  return (
    <Modal open title="Buscar" onClose={onClose}>
      <div className="stack">
        <div className="search">
          <Search size={18} aria-hidden />
          <input className="input" type="search" autoFocus placeholder="Equipo, jugador, documento..." aria-label="Buscar en el campeonato" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>

        {query.length < 2 ? (
          <p className="text-secondary text-small">Escribe al menos 2 letras. Se busca en el campeonato activo.</p>
        ) : results.error ? (
          <p className="text-secondary">No se pudo buscar. Inténtalo de nuevo.</p>
        ) : !data ? (
          <p className="text-secondary">Buscando…</p>
        ) : empty ? (
          <p className="text-secondary">Sin resultados para «{query}».</p>
        ) : (
          <div className="flush-list" style={{ margin: "0 calc(-1 * var(--space-lg))", border: "none" }}>
            {data.teams.length > 0 && (
              <section aria-label="Equipos">
                <h3 className="band band-muted band-small">Equipos</h3>
                {data.teams.map((team) => (
                  <Link key={team._id} href={`/teams/${team._id}`} className="list-row" onClick={onClose}>
                    <Avatar src={team.shieldUrl} name={team.name} size={36} square />
                    <span className="text-strong truncate">{team.name}</span>
                  </Link>
                ))}
              </section>
            )}
            {data.players.length > 0 && (
              <section aria-label="Jugadores">
                <h3 className="band band-muted band-small">Jugadores</h3>
                {data.players.map((player) => (
                  <Link key={player._id} href={`/players/${player._id}`} className="list-row" onClick={onClose}>
                    <Avatar src={player.photoUrl} name={player.fullName} size={36} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="text-strong truncate">{player.fullName}</div>
                      <div className="text-secondary text-small truncate">{player.teamName ?? "Sin equipo"}{player.shirtNumber != null && ` · #${player.shirtNumber}`}</div>
                    </div>
                  </Link>
                ))}
              </section>
            )}
            {data.matches.length > 0 && (
              <section aria-label="Partidos">
                <h3 className="band band-muted band-small">Partidos</h3>
                {data.matches.map((match) => (
                  <Link key={match._id} href={`/matches/${match._id}`} className="list-row" onClick={onClose}>
                    <Shield size={20} aria-hidden color="var(--color-text-disabled)" />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="text-strong truncate">{match.label}</div>
                      <div className="text-secondary text-small truncate">{match.phase} · {MATCH_STATUS_LABEL[match.status as MatchStatus]?.label ?? match.status}</div>
                    </div>
                  </Link>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

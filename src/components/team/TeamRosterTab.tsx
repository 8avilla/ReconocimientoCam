"use client";

import React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar, Badge, EmptyState, ErrorState, Loading } from "@/components/ui";
import { POSITIONS, type Position } from "@/lib/constants";
import { REGISTRATION_STATUS_LABEL } from "@/lib/labels";
import type { RosterEntryDTO } from "@/types/api";

const POSITION_TITLE: Record<Position, string> = { Portero: "Porteros", Defensa: "Defensas", Volante: "Volantes", Delantero: "Delanteros" };

interface Props {
  teamId: string;
  entries: RosterEntryDTO[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  /** Absent when the viewer cannot change the squad. */
  onEdit?: (entry: RosterEntryDTO) => void;
  /** Whether the viewer may open player profiles (visitors cannot). */
  linkPlayers?: boolean;
}

/** Squad grouped by position: photo with the shirt number, name and registration status. */
export function TeamRosterTab({ teamId, entries, loading, error, onRetry, onEdit, linkPlayers = true }: Props) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (loading && entries.length === 0) return <Loading />;
  if (entries.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Users size={28} />}
          title="Este equipo aún no tiene jugadores"
          description="Registra jugadores para armar la plantilla."
          action={onEdit && <Link href={`/players/new?teamId=${teamId}`} className="btn primary">Agregar jugador</Link>}
        />
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 0 }}>
      {POSITIONS.map((position) => {
        const list = entries.filter((entry) => entry.position === position).sort((a, b) => a.shirtNumber - b.shirtNumber);
        if (list.length === 0) return null;
        return (
          <section key={position} aria-label={POSITION_TITLE[position]}>
            <h3 className="band">{POSITION_TITLE[position]} <span className="text-secondary">({list.length})</span></h3>
            <ul style={{ listStyle: "none", background: "var(--color-surface)" }}>
              {list.map((entry) => {
                const status = REGISTRATION_STATUS_LABEL[entry.status];
                return (
                  <li key={entry._id} className="list-row">
                    <PlayerLink href={`/players/${entry.playerId._id}`} enabled={linkPlayers}>
                      <span className="shirt-photo">
                        <Avatar src={entry.playerId.photoUrl} name={entry.playerId.fullName} size={48} />
                        <span className="shirt-number">{entry.shirtNumber}</span>
                      </span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="text-strong truncate">{entry.playerId.fullName}</div>
                        {entry.status !== "active" && <Badge tone={status.tone}>{status.label}</Badge>}
                      </div>
                    </PlayerLink>
                    {onEdit && <button className="btn ghost small" onClick={() => onEdit(entry)} aria-label={`Editar inscripción de ${entry.playerId.fullName}`}>Editar</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Link to the player profile, or a plain block when the viewer cannot open it. */
function PlayerLink({ href, enabled, children }: { href: string; enabled: boolean; children: React.ReactNode }) {
  return enabled ? <Link href={href} className="row grow" style={{ minWidth: 0 }}>{children}</Link> : <div className="row grow" style={{ minWidth: 0 }}>{children}</div>;
}

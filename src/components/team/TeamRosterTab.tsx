"use client";

import React from "react";
import Link from "next/link";
import { Users, UserCog } from "lucide-react";
import { ActionMenu, Avatar, Badge, EmptyState, ErrorState, Loading } from "@/components/ui";
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
  /** Absent when the viewer cannot edit the player themselves (opens the full "Editar jugador" popup). */
  onExpressEdit?: (entry: RosterEntryDTO) => void;
  /** Whether the viewer may open player profiles (visitors cannot). */
  linkPlayers?: boolean;
}

/** Squad grouped by position: photo with the shirt number, name and registration status. */
export function TeamRosterTab({ teamId, entries, loading, error, onRetry, onExpressEdit, linkPlayers = true }: Props) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (loading && entries.length === 0) return <Loading />;
  if (entries.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Users size={28} />}
          title="Este equipo aún no tiene jugadores"
          description="Registra jugadores para armar la plantilla."
          action={onExpressEdit && <Link href={`/players/new?teamId=${teamId}`} className="btn primary">Agregar jugador</Link>}
        />
      </div>
    );
  }
  const byPosition = (position?: Position) =>
    entries.filter((entry) => entry.position === position).sort((a, b) => (a.shirtNumber ?? 0) - (b.shirtNumber ?? 0));
  const groups = [
    ...POSITIONS.map((position) => ({ key: position as string, title: POSITION_TITLE[position], list: byPosition(position) })),
    { key: "unspecified", title: "Sin posición", list: byPosition(undefined) },
  ];

  return (
    <div className="stack" style={{ gap: 0 }}>
      {groups.map(({ key, title, list }) => {
        if (list.length === 0) return null;
        return (
          <section key={key} aria-label={title}>
            <h3 className="band">{title} <span className="text-secondary">({list.length})</span></h3>
            <ul style={{ listStyle: "none", background: "var(--color-surface)" }}>
              {list.map((entry) => {
                const status = REGISTRATION_STATUS_LABEL[entry.status];
                return (
                  <li key={entry._id} className="list-row">
                    <PlayerLink href={`/players/${entry.playerId._id}`} enabled={linkPlayers}>
                      <span className="shirt-photo">
                        <Avatar src={entry.playerId.photoUrl} name={entry.playerId.fullName} size={48} />
                        <span className="shirt-number">{entry.shirtNumber ?? "–"}</span>
                      </span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="text-strong truncate">{entry.playerId.fullName}</div>
                        {entry.status !== "active" && <Badge tone={status.tone}>{status.label}</Badge>}
                      </div>
                    </PlayerLink>
                    {onExpressEdit && (
                      <ActionMenu
                        label={`Más acciones de ${entry.playerId.fullName}`}
                        actions={[{ label: "Editar", icon: <UserCog size={16} />, onClick: () => onExpressEdit(entry) }]}
                      />
                    )}
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

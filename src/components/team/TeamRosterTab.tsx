import React from "react";
import Link from "next/link";
import { LayoutGrid, List, Users } from "lucide-react";
import { FaceBadge } from "@/components/player/PlayerBadges";
import { FaceQueue } from "@/components/player/FaceQueue";
import { useOpenPlayer } from "@/components/player/PlayerSheetContext";
import { Avatar, Badge, EmptyState, ErrorState, Loading } from "@/components/ui";
import { POSITIONS, type Position } from "@/lib/constants";
import { useStoredState } from "@/lib/client/useStoredState";
import { REGISTRATION_STATUS_LABEL } from "@/lib/labels";
import type { RosterEntryDTO } from "@/types/api";

const POSITION_TITLE: Record<Position, string> = { Portero: "Porteros", Defensa: "Defensas", Volante: "Volantes", Delantero: "Delanteros" };

interface Props {
  teamId: string;
  entries: RosterEntryDTO[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  /** Whether the viewer may register new players (shows the "Agregar jugador" shortcut when the squad is empty). */
  canAddPlayer?: boolean;
  /** Where "Agregar jugador" goes (the registration wizard with this team chosen). */
  newPlayerHref?: string;
  /** Opens the "add several players" sheet; shown next to the single-player shortcut when the squad is empty. */
  onBulk?: () => void;
  /** Called after the player sheet changed something, so the roster can refresh. */
  onChanged?: () => void;
}

/** Squad grouped by position: photo with the shirt number, name, face registration and registration status. */
export function TeamRosterTab({ entries, loading, error, onRetry, canAddPlayer, newPlayerHref, onBulk, onChanged }: Props) {
  const [viewMode, setViewMode] = useStoredState<"list" | "grid">("super-torneos:view:roster", "list", (value) => value === "list" || value === "grid");
  const openPlayer = useOpenPlayer();

  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (loading && entries.length === 0) return <Loading />;
  if (entries.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Users size={28} />}
          title="Este equipo aún no tiene jugadores"
          description="Registra jugadores para armar la plantilla."
          action={canAddPlayer && newPlayerHref && (
            <div className="row-wrap" style={{ justifyContent: "center" }}>
              <Link href={newPlayerHref} className="btn primary">Agregar jugador</Link>
              {onBulk && <button className="btn secondary" onClick={onBulk}>Agregar varios</button>}
            </div>
          )}
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
      {canAddPlayer && (
        <FaceQueue
          players={entries.filter((entry) => entry.status === "active" && !entry.playerId.hasFace).map((entry) => ({ _id: entry.playerId._id, fullName: entry.playerId.fullName }))}
          onChanged={() => onChanged?.()}
        />
      )}
      {/* Roster View Toggle Bar */}
      <div className="view-toggle-bar">
        <button
          className={`view-toggle-btn${viewMode === "list" ? " active" : ""}`}
          onClick={() => setViewMode("list")}
          title="Vista de lista"
        >
          <List size={16} /> Lista
        </button>
        <button
          className={`view-toggle-btn${viewMode === "grid" ? " active" : ""}`}
          onClick={() => setViewMode("grid")}
          title="Vista de tarjetas"
        >
          <LayoutGrid size={16} /> Tarjetas
        </button>
      </div>

      {groups.map(({ key, title, list }) => {
        if (list.length === 0) return null;
        return (
          <section key={key} aria-label={title} style={{ marginBottom: "var(--space-md)" }}>
            <h3 className="band">{title} <span className="text-secondary">({list.length})</span></h3>
            
            {viewMode === "list" ? (
              <ul style={{ listStyle: "none", background: "var(--color-surface)" }}>
                {list.map((entry) => {
                  const status = REGISTRATION_STATUS_LABEL[entry.status];
                  return (
                    <li key={entry._id} className="list-row">
                      <PlayerLink onOpen={() => openPlayer(entry.playerId._id, onChanged)}>
                        <span className="shirt-photo">
                          <Avatar src={entry.playerId.photoUrl} name={entry.playerId.fullName} size={48} />
                          <span className="shirt-number">{entry.shirtNumber ?? "–"}</span>
                        </span>
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="text-strong truncate">{entry.playerId.fullName}</div>
                          <div className="row-wrap" style={{ gap: 6, marginTop: 2 }}>
                            {entry.status !== "active" && <Badge tone={status.tone}>{status.label}</Badge>}
                            <FaceBadge hasFace={entry.playerId.hasFace} />
                          </div>
                        </div>
                      </PlayerLink>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="roster-card-grid">
                {list.map((entry) => {
                  const status = REGISTRATION_STATUS_LABEL[entry.status];
                  return (
                    <div key={entry._id} className="roster-card">
                      <PlayerLink onOpen={() => openPlayer(entry.playerId._id, onChanged)}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span className="shirt-photo" style={{ marginBottom: 8 }}>
                            <Avatar src={entry.playerId.photoUrl} name={entry.playerId.fullName} size={64} />
                            <span className="shirt-number" style={{ width: 24, height: 24, fontSize: 12 }}>
                              #{entry.shirtNumber ?? "–"}
                            </span>
                          </span>
                          <div className="truncate" style={{ maxWidth: 160, fontSize: 13 }}>
                            {entry.playerId.fullName}
                          </div>
                          <div className="stack-sm" style={{ gap: 4, marginTop: 6, alignItems: "center" }}>
                            {entry.status !== "active" && <Badge tone={status.tone}>{status.label}</Badge>}
                            <FaceBadge hasFace={entry.playerId.hasFace} />
                          </div>
                        </div>
                      </PlayerLink>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Opens the player sheet (everyone can see it; what it shows depends on the viewer's role). */
function PlayerLink({ onOpen, children }: { onOpen: () => void; children: React.ReactNode }) {
  return <button type="button" className="row grow" style={{ minWidth: 0, textAlign: "left" }} onClick={onOpen}>{children}</button>;
}

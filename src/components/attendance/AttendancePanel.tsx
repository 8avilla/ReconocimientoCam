"use client";

import { useState } from "react";
import { ClipboardCheck, ScanLine, Search } from "lucide-react";
import { CheckInBadge, VerificationBadge } from "@/components/attendance/AttendanceBadges";
import { ManualCheckInModal } from "@/components/attendance/ManualCheckInModal";
import { QR_VERIFICATION_ENABLED } from "@/lib/features";
import { VerificationFlow } from "@/components/verification/VerificationFlow";
import { Avatar, Badge, Button, EmptyState } from "@/components/ui";
import { SUSPENSION_REASON_LABEL } from "@/lib/labels";
import type { AttendanceDTO, AttendanceRowDTO, MatchDTO } from "@/types/api";

interface Props {
  matchId: string;
  match: MatchDTO;
  attendance: AttendanceDTO;
  /** Read-only view (e.g. delegate): no verification or manual check-in. */
  readOnly?: boolean;
  /** Reloads the match data after attendance changes. */
  onChanged: () => void;
}

/** Attendance of a match: the whole squad of both teams, with QR/face verification and manual contingency. */
export function AttendancePanel({ matchId, match, attendance, onChanged, readOnly }: Props) {
  // One team at a time: home on the left tab, away on the right one.
  const [teamId, setTeamId] = useState(match.homeTeamId._id);
  const [search, setSearch] = useState("");
  const [flow, setFlow] = useState<{ open: boolean; code?: string }>({ open: false });
  const [manualFor, setManualFor] = useState<AttendanceRowDTO | null>(null);

  const { checkIns } = attendance;
  const teamSuspended = (attendance.suspended ?? []).filter((item) => item.teamId === teamId);
  const canOperate = !readOnly && (match.status === "scheduled" || match.status === "live");
  const teams = [match.homeTeamId, match.awayTeamId];

  const term = search.trim().toLowerCase();
  const rows = checkIns
    .filter((row) => row.teamId === teamId)
    .filter((row) => !term || row.playerId.fullName.toLowerCase().includes(term) || String(row.shirtNumber ?? "") === term)
    .sort((a, b) => (a.shirtNumber ?? 0) - (b.shirtNumber ?? 0));

  const rowActions = (row: AttendanceRowDTO) =>
    canOperate && (
      <div className="row" style={{ justifyContent: "flex-end", gap: "var(--space-xs)" }}>
        {row.status !== "present" && row.registrationStatus === "active" && (
          <Button size="small" onClick={() => setFlow({ open: true, code: row.playerId.publicId })}>Verificar</Button>
        )}
        <Button size="small" variant="ghost" onClick={() => setManualFor(row)}>Manual</Button>
      </div>
    );

  return (
    <div className="stack" style={{ gap: 0 }}>
      {canOperate && QR_VERIFICATION_ENABLED && (
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <Button size="large" icon={<ScanLine size={20} />} onClick={() => setFlow({ open: true })}>Escanear jugador</Button>
        </div>
      )}

      <div className="team-tabs" role="tablist" aria-label="Equipo">
        {teams.map((team) => {
          const squad = checkIns.filter((row) => row.teamId === team._id);
          const present = squad.filter((row) => row.status === "present").length;
          return (
            <button key={team._id} role="tab" aria-selected={teamId === team._id} className={`team-tab${teamId === team._id ? " active" : ""}`} onClick={() => setTeamId(team._id)}>
              <Avatar src={team.shieldUrl} name={team.name} size={32} square />
              <span className="team-tab-name">{team.name}</span>
              <span className="team-tab-count">{present}/{squad.length} presentes</span>
            </button>
          );
        })}
      </div>
      <div className="search" style={{ marginBottom: "var(--space-lg)", maxWidth: 420 }}>
        <Search size={18} aria-hidden />
        <input className="input" type="search" placeholder="Buscar por nombre o número..." aria-label="Buscar jugador" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ClipboardCheck size={28} />}
            title={checkIns.length === 0 ? "Sin jugadores" : "Sin resultados"}
            description={checkIns.length === 0 ? "Los equipos no tienen jugadores activos en su plantilla." : "Este equipo no tiene jugadores con esa búsqueda."}
          />
        </div>
      ) : (
        <div className="flush-list">
          <div className="table-wrap only-desktop">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Jugador</th><th>Estado</th><th>Verificación</th><th>Hora</th><th aria-label="Acciones" /></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.shirtNumber}</td>
                    <td><span className="row"><Avatar src={row.playerId.photoUrl} name={row.playerId.fullName} size={36} /><span className="text-strong">{row.playerId.fullName}</span></span></td>
                    <td><CheckInBadge status={row.status} /></td>
                    <td>
                      <VerificationBadge verification={row.verificationId} />
                      {row.verificationId?.confidence !== undefined && <span className="text-secondary text-small"> {(row.verificationId.confidence * 100).toFixed(1)}%</span>}
                    </td>
                    <td className="text-secondary">{row.checkedInAt ? new Date(row.checkedInAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td>{rowActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="only-mobile">
            {rows.map((row) => (
              <div key={row._id} className="list-row" style={{ alignItems: "flex-start" }}>
                <Avatar src={row.playerId.photoUrl} name={row.playerId.fullName} size={44} />
                <div className="grow stack-sm" style={{ gap: 4, minWidth: 0 }}>
                  <div>
                    <div className="champ-caption">#{row.shirtNumber}</div>
                    <div className="champ-name">{row.playerId.fullName}</div>
                  </div>
                  <div className="row-wrap" style={{ gap: 6 }}>
                    <CheckInBadge status={row.status} />
                    <VerificationBadge verification={row.verificationId} />
                  </div>
                  {rowActions(row)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {teamSuspended.length > 0 && (
        <div className="flush-list" style={{ marginTop: "var(--space-lg)" }}>
          <h3 className="band band-small" style={{ background: "var(--color-error-bg)", color: "#991b1b" }}>Suspendidos, no pueden jugar ({teamSuspended.length})</h3>
          {teamSuspended.map((item) => (
            <div key={item._id} className="list-row">
              <Avatar src={item.playerId.photoUrl} name={item.playerId.fullName} size={44} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="champ-caption">{item.registrationId?.shirtNumber != null ? `#${item.registrationId.shirtNumber} · ` : ""}{SUSPENSION_REASON_LABEL[item.reason]}</div>
                <div className="champ-name truncate">{item.playerId.fullName}</div>
                <div className="text-secondary text-small">Cumplió {item.matchesServed} de {item.matchesToServe} {item.matchesToServe === 1 ? "partido" : "partidos"}</div>
              </div>
              <Badge tone="error">Suspendido</Badge>
            </div>
          ))}
        </div>
      )}

      <VerificationFlow open={flow.open} matchId={matchId} initialCode={flow.code} onClose={() => setFlow({ open: false })} onRegistered={onChanged} />
      {manualFor && (
        <ManualCheckInModal
          open
          matchId={matchId}
          player={manualFor.playerId}
          onClose={() => setManualFor(null)}
          onSaved={() => {
            setManualFor(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

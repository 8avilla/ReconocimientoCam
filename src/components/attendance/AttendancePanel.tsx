"use client";

import { useState } from "react";
import { ClipboardCheck, ScanLine, Search } from "lucide-react";
import { CheckInBadge, VerificationBadge } from "@/components/attendance/AttendanceBadges";
import { ManualCheckInModal } from "@/components/attendance/ManualCheckInModal";
import { QR_VERIFICATION_ENABLED } from "@/lib/features";
import { VerificationFlow } from "@/components/verification/VerificationFlow";
import { Avatar, Button, EmptyState } from "@/components/ui";
import type { AttendanceDTO, AttendanceRowDTO, MatchDTO } from "@/types/api";

type Filter = "all" | "verified" | "pending" | "absent";

const isVerified = (row: AttendanceRowDTO) => row.status === "present" && row.verificationId?.result === "verified";

const FILTERS: { id: Filter; label: string; matches: (row: AttendanceRowDTO) => boolean }[] = [
  { id: "all", label: "Todos", matches: () => true },
  { id: "verified", label: "Verificados", matches: isVerified },
  { id: "pending", label: "Pendientes", matches: (row) => row.status === "pending" },
  { id: "absent", label: "Ausentes", matches: (row) => row.status === "absent" },
];

interface Props {
  matchId: string;
  match: MatchDTO;
  attendance: AttendanceDTO;
  /** Reloads the match data after attendance changes. */
  onChanged: () => void;
}

/** Attendance of a match: the whole squad of both teams, with QR/face verification and manual contingency. */
export function AttendancePanel({ matchId, match, attendance, onChanged }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [teamId, setTeamId] = useState("");
  const [search, setSearch] = useState("");
  const [flow, setFlow] = useState<{ open: boolean; code?: string }>({ open: false });
  const [manualFor, setManualFor] = useState<AttendanceRowDTO | null>(null);

  const { checkIns } = attendance;
  const canOperate = match.status === "scheduled" || match.status === "live";
  const teamName = (id: string) => (id === match.homeTeamId._id ? match.homeTeamId.name : match.awayTeamId.name);

  const term = search.trim().toLowerCase();
  const activeFilter = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  const rows = checkIns
    .filter((row) => activeFilter.matches(row))
    .filter((row) => !teamId || row.teamId === teamId)
    .filter((row) => !term || row.playerId.fullName.toLowerCase().includes(term) || String(row.shirtNumber ?? "") === term)
    .sort((a, b) => a.teamId.localeCompare(b.teamId) || (a.shirtNumber ?? 0) - (b.shirtNumber ?? 0));

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

      <div className="row-wrap" style={{ marginBottom: "var(--space-md)" }} role="tablist" aria-label="Filtrar asistencia">
        {FILTERS.map((item) => (
          <Button key={item.id} role="tab" aria-selected={filter === item.id} size="small" variant={filter === item.id ? "primary" : "secondary"} onClick={() => setFilter(item.id)}>
            {item.label} ({checkIns.filter(item.matches).length})
          </Button>
        ))}
      </div>
      <div className="row-wrap" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="search grow" style={{ minWidth: 220, maxWidth: 420 }}>
          <Search size={18} aria-hidden />
          <input className="input" type="search" placeholder="Buscar por nombre o número..." aria-label="Buscar jugador" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: "auto", minWidth: 200 }} aria-label="Filtrar por equipo" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">Ambos equipos</option>
          <option value={match.homeTeamId._id}>{match.homeTeamId.name}</option>
          <option value={match.awayTeamId._id}>{match.awayTeamId.name}</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ClipboardCheck size={28} />}
            title={checkIns.length === 0 ? "Sin jugadores" : "Sin resultados"}
            description={checkIns.length === 0 ? "Los equipos no tienen jugadores activos en su plantilla." : "Prueba con otros filtros."}
          />
        </div>
      ) : (
        <div className="card flush">
          <div className="table-wrap only-desktop">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Estado</th><th>Verificación</th><th>Hora</th><th aria-label="Acciones" /></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.shirtNumber}</td>
                    <td><span className="row"><Avatar src={row.playerId.photoUrl} name={row.playerId.fullName} size={36} /><span className="text-strong">{row.playerId.fullName}</span></span></td>
                    <td>{teamName(row.teamId)}</td>
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
                <Avatar src={row.playerId.photoUrl} name={row.playerId.fullName} size={48} />
                <div className="grow stack-sm" style={{ gap: 4 }}>
                  <div className="text-strong">#{row.shirtNumber} · {row.playerId.fullName}</div>
                  <div className="text-secondary text-small">{teamName(row.teamId)}</div>
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

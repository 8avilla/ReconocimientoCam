import type { OutboxOp } from "./outbox";
import type { AttendanceDTO, AttendanceRowDTO, CheckInStatusDTO } from "@/types/api";

/** The check-in an op leaves behind for a player, mirroring what the server does with it. */
function applyOp(rows: AttendanceRowDTO[], op: OutboxOp): AttendanceRowDTO[] {
  const payload = op.payload as { status?: CheckInStatusDTO; playerId?: string; playerIds?: string[]; teamId?: string; reason?: string };
  const status = payload.status;
  if (!status) return rows;
  const targets = (row: AttendanceRowDTO) => {
    if (payload.playerId) return row.playerId._id === payload.playerId;
    if (payload.playerIds) return payload.playerIds.includes(row.playerId._id);
    // "Mark the whole squad present": only players still pending, and only if they may play.
    return row.teamId === payload.teamId && row.status === "pending" && row.registrationStatus === "active";
  };
  return rows.map((row) => {
    if (!targets(row)) return row;
    // Nobody can be marked present while suspended or otherwise inactive; the server refuses it too.
    if (status === "present" && row.registrationStatus !== "active") return row;
    if (status === "pending") return { ...row, status, method: undefined, checkedInAt: undefined, manualReason: undefined, pendingSync: true };
    return { ...row, status, method: "manual", checkedInAt: op.occurredAt, manualReason: payload.reason, pendingSync: true };
  });
}

/** The attendance as the server last told it, with this device's not-yet-synced changes on top. */
export function applyPendingOps(attendance: AttendanceDTO, pending: OutboxOp[], matchId: string): AttendanceDTO {
  const mine = pending.filter((op) => op.matchId === matchId);
  if (mine.length === 0) return attendance;
  const checkIns = mine.reduce(applyOp, attendance.checkIns);
  const summary = { called: checkIns.length, present: 0, absent: 0, pending: 0, verified: 0 };
  for (const row of checkIns) {
    summary[row.status] += 1;
    if (row.status === "present" && (row.method === "face" || row.verificationId?.result === "verified")) summary.verified += 1;
  }
  return { ...attendance, checkIns, summary };
}

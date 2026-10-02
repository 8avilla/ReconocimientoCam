import type { Actor } from "@/lib/actor";
import { conflict, notFound } from "@/lib/api";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { QR_VERIFICATION_ENABLED } from "@/lib/features";
import { recordAudit } from "@/lib/audit";
import { cached } from "@/lib/serverCache";
import { isStale, resolveOccurredAt } from "@/lib/rules/offline";
import { Match } from "@/models/Match";
import { syncMatchCallUps } from "@/lib/services/callups";
import { MatchCallUp } from "@/models/MatchCallUp";
import { IdentityVerification } from "@/models/IdentityVerification";
import { Suspension } from "@/models/Suspension";
import { CheckInMethod, PlayerCheckIn } from "@/models/PlayerCheckIn";

export interface RegisterCheckInInput {
  playerId: string;
  status: "present" | "absent";
  method?: "qr" | "manual";
  reason?: string;
  /** Confirms attendance from a successful verification; the method is derived from it. */
  verificationId?: string;
  /** Set when the change was made offline and is synced later (see `lib/rules/offline`). */
  occurredAt?: Date;
}

const VERIFICATION_MAX_AGE_MS = 15 * 60 * 1000;

/** Records attendance for a called-up player. Face verification is handled by its own flow. */
export async function registerCheckIn(actor: Actor, matchId: string, input: RegisterCheckInInput) {
  if (input.method === "qr" && !QR_VERIFICATION_ENABLED) {
    throw conflict("El registro por QR está deshabilitado por el momento", "qr_disabled");
  }
  await syncMatchCallUps(matchId);
  const match = await Match.findById(matchId).lean();
  if (!match) throw notFound("Partido no encontrado");
  await requireOrganizerOfChampionship(actor, match.championshipId);
  if (match.status !== "scheduled" && match.status !== "live") {
    throw conflict("El partido no admite registro de asistencia", "match_not_open");
  }

  const checkIn = await PlayerCheckIn.findOne({ matchId: match._id, playerId: input.playerId });
  if (!checkIn) throw notFound("El jugador no está convocado en este partido");

  const { at, offline } = resolveOccurredAt(input.occurredAt);
  if (isStale(checkIn.checkedInAt, at, offline)) {
    throw conflict("Ya hay un registro más reciente de este jugador; no se aplicó el cambio hecho sin conexión", "stale_offline");
  }

  let method: CheckInMethod = input.method ?? "manual";
  let manualReason = input.method === "manual" ? input.reason : undefined;
  let verificationId = checkIn.verificationId;

  if (input.verificationId) {
    const verification = await IdentityVerification.findById(input.verificationId).lean();
    if (
      !verification ||
      verification.matchId.toString() !== matchId ||
      verification.playerId.toString() !== input.playerId ||
      verification.result !== "verified"
    ) {
      throw conflict("La verificación no corresponde a este jugador o no fue exitosa", "invalid_verification");
    }
    if (Date.now() - verification.performedAt.getTime() > VERIFICATION_MAX_AGE_MS) {
      throw conflict("La verificación expiró; vuelve a verificar al jugador", "verification_expired");
    }
    if (checkIn.status === "present") {
      throw conflict("El jugador ya está registrado como presente", "already_present");
    }
    method = verification.method === "face" ? "face" : "manual";
    manualReason = verification.manualReason;
    verificationId = verification._id;
  }

  checkIn.set({
    status: input.status,
    method,
    checkedInAt: at,
    operatorName: actor.name,
    operatorUserId: actor.userId,
    manualReason,
    verificationId,
  });
  await checkIn.save();

  await recordAudit(actor, {
    action: "check_in",
    entityType: "check_in",
    entityId: checkIn._id,
    championshipId: match.championshipId,
    summary: `Asistencia ${input.status === "present" ? "presente" : "ausente"} (${method})${offline ? " · registrada sin conexión" : ""}`,
    changes: { matchId, playerId: input.playerId, reason: manualReason, verificationId: verificationId?.toString(), ...(offline ? { occurredAt: at.toISOString() } : {}) },
  });
  return checkIn;
}

export interface BulkCheckInInput {
  status: "present" | "absent" | "pending";
  playerIds?: string[];
  teamId?: string;
  /** Set when the change was made offline and is synced later. */
  occurredAt?: Date;
}

/**
 * Manual attendance for many players in one go, with no per-player reason: "mark the whole squad present"
 * (only those still pending) or set/undo the state of specific players. Players whose registration is not
 * active (suspended, etc.) are never marked present. Returns the players that changed.
 */
export async function registerBulkCheckIn(actor: Actor, matchId: string, input: BulkCheckInInput) {
  await syncMatchCallUps(matchId);
  const match = await Match.findById(matchId).lean();
  if (!match) throw notFound("Partido no encontrado");
  await requireOrganizerOfChampionship(actor, match.championshipId);
  if (match.status !== "scheduled" && match.status !== "live") {
    throw conflict("El partido no admite registro de asistencia", "match_not_open");
  }

  const scope = input.playerIds
    ? { playerId: { $in: input.playerIds } }
    : { teamId: input.teamId, status: "pending" as const };
  let rows = await PlayerCheckIn.find({ matchId: match._id, ...scope });

  if (input.status === "present") {
    const callUps = await MatchCallUp.find({ _id: { $in: rows.map((row) => row.callUpId) } })
      .populate({ path: "registrationId", select: "status" })
      .lean();
    const active = new Set(
      callUps.filter((callUp) => (callUp.registrationId as unknown as { status?: string } | null)?.status === "active").map((callUp) => callUp._id.toString())
    );
    rows = rows.filter((row) => active.has(row.callUpId.toString()));
  }

  const { at: now, offline } = resolveOccurredAt(input.occurredAt);
  // Whoever marked a player more recently wins over an older offline change: those players are skipped and reported.
  const skipped = rows.filter((row) => isStale(row.checkedInAt, now, offline)).map((row) => row.playerId.toString());
  if (skipped.length > 0) rows = rows.filter((row) => !skipped.includes(row.playerId.toString()));
  for (const row of rows) {
    if (input.status === "pending") {
      row.set({ status: "pending", method: undefined, checkedInAt: undefined, manualReason: undefined, operatorName: actor.name, operatorUserId: actor.userId });
    } else {
      row.set({
        status: input.status,
        method: "manual",
        checkedInAt: now,
        manualReason: input.status === "present" && !input.playerIds ? "Marcado en bloque" : undefined,
        operatorName: actor.name,
        operatorUserId: actor.userId,
      });
    }
    await row.save();
  }

  if (rows.length > 0) {
    await recordAudit(actor, {
      action: "check_in",
      entityType: "check_in",
      entityId: rows[0]._id,
      championshipId: match.championshipId,
      summary: `Asistencia ${input.status === "present" ? "presente" : input.status === "absent" ? "ausente" : "pendiente"} (manual) para ${rows.length} jugador(es)${offline ? " · registrada sin conexión" : ""}`,
      changes: { matchId, playerIds: rows.map((row) => row.playerId.toString()), bulk: !input.playerIds, ...(offline ? { occurredAt: now.toISOString(), skippedAsStale: skipped } : {}) },
    });
  }
  return { updated: rows.map((row) => row.playerId.toString()), skipped };
}

export async function getAttendance(matchId: string) {
  // The call-up list only changes when squads or the match change, so a recent sync is reused (any write invalidates
  // it, see `serverCache`); and what does not depend on it is read alongside instead of after it.
  const [, match] = await Promise.all([
    cached(`callups-sync:${matchId}`, 15_000, () => syncMatchCallUps(matchId)),
    Match.findById(matchId).select("homeTeamId awayTeamId").lean(),
  ]);
  const [checkIns, callUps, suspended] = await Promise.all([
    PlayerCheckIn.find({ matchId })
      .populate({ path: "playerId", select: "publicId fullName photoUrl photoBlobName biometricConsentAt" })
      .populate({ path: "verificationId", select: "result confidence method performedAt" })
      .lean(),
    MatchCallUp.find({ matchId }).populate({ path: "registrationId", select: "shirtNumber position status" }).lean(),
    // Suspended players are not called up; listing them explains why they are missing from the squad.
    match
      ? Suspension.find({ teamId: { $in: [match.homeTeamId, match.awayTeamId] }, status: "active" })
          .populate({ path: "playerId", select: "publicId fullName photoUrl" })
          .populate({ path: "registrationId", select: "shirtNumber" })
          .select("teamId playerId registrationId reason matchesToServe matchesServed")
          .lean()
      : Promise.resolve([]),
  ]);
  const registrationByCallUp = new Map(callUps.map((callUp) => [callUp._id.toString(), callUp.registrationId]));

  const rows = checkIns.map(({ callUpId, ...checkIn }) => {
    const registration = registrationByCallUp.get(callUpId.toString()) as unknown as
      | { shirtNumber: number; position: string; status: string }
      | undefined;
    return {
      ...checkIn,
      shirtNumber: registration?.shirtNumber ?? null,
      position: registration?.position ?? null,
      registrationStatus: registration?.status ?? null,
    };
  });

  const summary = { called: rows.length, present: 0, absent: 0, pending: 0, verified: 0 };
  for (const row of rows) {
    summary[row.status] += 1;
    const verification = row.verificationId as unknown as { result?: string } | undefined;
    if (row.status === "present" && (row.method === "face" || verification?.result === "verified")) summary.verified += 1;
  }

  return { checkIns: rows, summary, suspended };
}

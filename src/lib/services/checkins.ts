import type { Actor } from "@/lib/actor";
import { conflict, notFound } from "@/lib/api";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { QR_VERIFICATION_ENABLED } from "@/lib/features";
import { recordAudit } from "@/lib/audit";
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
    checkedInAt: new Date(),
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
    summary: `Asistencia ${input.status === "present" ? "presente" : "ausente"} (${method})`,
    changes: { matchId, playerId: input.playerId, reason: manualReason, verificationId: verificationId?.toString() },
  });
  return checkIn;
}

export async function getAttendance(matchId: string) {
  await syncMatchCallUps(matchId);
  const [checkIns, callUps] = await Promise.all([
    PlayerCheckIn.find({ matchId })
      .populate({ path: "playerId", select: "publicId fullName photoUrl photoBlobName biometricConsentAt" })
      .populate({ path: "verificationId", select: "result confidence method performedAt" })
      .lean(),
    MatchCallUp.find({ matchId }).populate({ path: "registrationId", select: "shirtNumber position status" }).lean(),
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

  // Suspended players are not called up; listing them explains why they are missing from the squad.
  const match = await Match.findById(matchId).select("homeTeamId awayTeamId").lean();
  const suspended = match
    ? await Suspension.find({ teamId: { $in: [match.homeTeamId, match.awayTeamId] }, status: "active" })
        .populate({ path: "playerId", select: "publicId fullName photoUrl" })
        .populate({ path: "registrationId", select: "shirtNumber" })
        .select("teamId playerId registrationId reason matchesToServe matchesServed")
        .lean()
    : [];
  return { checkIns: rows, summary, suspended };
}

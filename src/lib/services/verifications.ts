import { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { ApiError, conflict, notFound } from "@/lib/api";
import { requireOrganizer, requireOrganizerOfChampionship } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { cosineSimilarity, EMBEDDING_VERSION, warmFaceEngine } from "@/lib/faceEngine/embedding";
import { getGallery, type GalleryEntry } from "@/lib/services/faceGallery";
import { classifySimilarity } from "@/lib/faceEngine/verification";
import { syncMatchCallUps } from "@/lib/services/callups";
import { embedFaceOrFail, prepareFaceImage } from "@/lib/services/players";
import { Championship, IChampionship } from "@/models/Championship";
import { IdentityVerification, VerificationResult } from "@/models/IdentityVerification";
import { IMatch, Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { IPlayer, Player } from "@/models/Player";
import { IPlayerCheckIn, PlayerCheckIn } from "@/models/PlayerCheckIn";
import { ITeam, Team } from "@/models/Team";
import { ITeamRegistration, TeamRegistration } from "@/models/TeamRegistration";

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

interface MatchPlayerContext {
  match: IMatch;
  championship: IChampionship;
  player: IPlayer;
  checkIn: IPlayerCheckIn & { _id: IPlayerCheckIn["_id"] };
  registration: ITeamRegistration;
  team: ITeam;
}

/** Loads everything needed to identify a called-up player of a match. */
async function loadContext(matchId: string, playerId: string, withEmbedding = false, actor?: Actor): Promise<MatchPlayerContext> {
  await syncMatchCallUps(matchId);
  const match = await Match.findById(matchId).lean();
  if (!match) throw notFound("Partido no encontrado");

  const [championship, player, checkIn, callUp] = await Promise.all([
    Championship.findById(match.championshipId).lean(),
    Player.findById(playerId).select(withEmbedding ? "+faceEmbedding" : "").lean(),
    PlayerCheckIn.findOne({ matchId: match._id, playerId }).lean(),
    MatchCallUp.findOne({ matchId: match._id, playerId }).lean(),
  ]);
  if (!championship) throw notFound("Campeonato no encontrado");
  if (!player) throw notFound("Jugador no encontrado");
  if (!checkIn || !callUp) throw notFound("El jugador no está convocado en este partido");

  const [registration, team] = await Promise.all([
    TeamRegistration.findById(callUp.registrationId).lean(),
    Team.findById(callUp.teamId).lean(),
  ]);
  if (!registration || !team) throw notFound("Inscripción del jugador no encontrada");
  if (actor) requireOrganizer(actor, championship);
  return { match, championship, player, checkIn, registration, team };
}

function assertCanVerify({ match, registration }: MatchPlayerContext) {
  if (match.status !== "scheduled" && match.status !== "live") {
    throw conflict("El partido no admite verificaciones", "match_not_open");
  }
  if (registration.status !== "active") {
    throw conflict(
      registration.status === "suspended" ? "El jugador está suspendido" : "El jugador no está habilitado",
      "player_not_eligible"
    );
  }
}

/** Resolves a scanned QR payload (public id) or a typed document number to a called-up player. */
export async function lookupPlayer(matchId: string, code: string) {
  const normalized = code.trim();
  const player = await Player.findOne({
    $or: [{ publicId: normalized.toUpperCase() }, { documentId: normalized }],
  }).lean();
  if (!player) throw notFound("No se encontró un jugador con ese código");

  const context = await loadContext(matchId, player._id.toString());
  return {
    player: {
      _id: player._id,
      publicId: player.publicId,
      fullName: player.fullName,
      photoUrl: player.photoUrl,
      facePhotoUrl: player.facePhotoUrl,
      hasFace: Boolean(player.photoUrl && player.biometricConsentAt),
    },
    team: { _id: context.team._id, name: context.team.name, shieldUrl: context.team.shieldUrl },
    shirtNumber: context.registration.shirtNumber,
    position: context.registration.position,
    registrationStatus: context.registration.status,
    checkInStatus: context.checkIn.status,
    allowManualReview: context.championship.rules.allowManualReview,
  };
}

/** Compares a captured face against the player's registered face (1:1) and records the outcome. */
export async function verifyFace(actor: Actor, matchId: string, playerId: string, image: string) {
  const context = await loadContext(matchId, playerId, true, actor);
  assertCanVerify(context);

  if (!context.player.faceEmbedding || context.player.faceEmbedding.length === 0) {
    throw conflict("El jugador no tiene un rostro registrado", "no_face");
  }

  if ((context.player.embeddingVersion ?? 1) !== EMBEDDING_VERSION) {
    throw conflict("El rostro registrado es de una versión anterior; vuelve a registrarlo", "face_outdated");
  }

  const recentFailures = await IdentityVerification.countDocuments({
    matchId,
    playerId,
    method: "face",
    result: { $ne: "verified" },
    performedAt: { $gte: new Date(Date.now() - ATTEMPT_WINDOW_MS) },
  });
  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    throw new ApiError(429, "Demasiados intentos fallidos. Usa la revisión manual.", "too_many_attempts");
  }

  const captured = await embedFaceOrFail(await prepareFaceImage(image), { padFirst: true });
  const similarity = cosineSimilarity(captured, Float32Array.from(context.player.faceEmbedding));
  const result: VerificationResult = classifySimilarity(similarity, context.championship.rules);

  const verification = await IdentityVerification.create({
    matchId,
    playerId,
    checkInId: context.checkIn._id,
    result,
    confidence: Math.round(similarity * 10000) / 10000,
    method: "face",
    operatorName: actor.name,
    operatorUserId: actor.userId,
  });
  await PlayerCheckIn.updateOne({ _id: context.checkIn._id }, { verificationId: verification._id });

  await recordAudit(actor, {
    action: "create",
    entityType: "verification",
    entityId: verification._id,
    championshipId: context.match.championshipId,
    summary: `Verificación facial de ${context.player.fullName}: ${result}`,
    changes: { matchId, playerId, confidence: verification.confidence },
  });

  return {
    verificationId: verification._id,
    result,
    confidence: verification.confidence,
    allowManualReview: context.championship.rules.allowManualReview,
  };
}

/** A referee overrides a non-conclusive or failed automatic result; requires a reason and is audited. */
export async function approveManually(actor: Actor, matchId: string, playerId: string, reason: string) {
  const context = await loadContext(matchId, playerId, false, actor);
  assertCanVerify(context);
  if (!context.championship.rules.allowManualReview) {
    throw new ApiError(403, "Este campeonato no permite la revisión manual", "manual_review_disabled");
  }

  const verification = await IdentityVerification.create({
    matchId,
    playerId,
    checkInId: context.checkIn._id,
    result: "verified",
    method: "manual_review",
    operatorName: actor.name,
    operatorUserId: actor.userId,
    manualReason: reason,
  });
  await PlayerCheckIn.updateOne({ _id: context.checkIn._id }, { verificationId: verification._id });

  await recordAudit(actor, {
    action: "create",
    entityType: "verification",
    entityId: verification._id,
    championshipId: context.match.championshipId,
    summary: `Revisión manual aprobada para ${context.player.fullName}`,
    changes: { matchId, playerId, reason },
  });
  return { verificationId: verification._id, result: verification.result };
}

/** A match's best score must beat the runner-up by this much to register someone without asking. */
const IDENTIFY_MARGIN = 0.05;

export type IdentifyStatus = "no_face" | "identified" | "already_present" | "suspended" | "uncertain" | "unknown";

/** Loads the models and prepares the faces of a match before the camera starts (so the first frame is fast). */
export async function warmIdentification(matchId: string) {
  const [, { gallery, cached }] = await Promise.all([warmFaceEngine(), getGallery(matchId)]);
  return { faces: gallery.entries.filter((entry) => !entry.suspended).length, withoutFace: gallery.withoutFace.length, cached };
}

/**
 * Attendance by camera (1:N): compares a face against every player of both squads and, when one clearly matches,
 * registers them as present (recording the verification). Ambiguous faces return the closest candidates so the
 * operator confirms; suspended players are recognized but never registered. The squads' faces come from a
 * per-match gallery kept in memory, so each frame only pays for the face itself plus one light query.
 */
export async function identifyFace(actor: Actor, matchId: string, image: string) {
  const started = performance.now();
  const { gallery, cached } = await getGallery(matchId);
  const galleryMs = performance.now() - started;
  await requireOrganizerOfChampionship(actor, gallery.championshipId);
  if (gallery.matchStatus !== "scheduled" && gallery.matchStatus !== "live") throw conflict("El partido no admite registro de asistencia", "match_not_open");

  const statuses = new Map((await PlayerCheckIn.find({ matchId }).select("playerId status").lean()).map((row) => [row.playerId.toString(), row.status]));
  const pendingWithoutFace = gallery.withoutFace.filter((id) => statuses.get(id) === "pending").length;
  const timings = (extra: Record<string, number> = {}) => {
    const total = performance.now() - started;
    const rounded = Object.fromEntries(Object.entries({ galleryMs, ...extra, totalMs: total }).map(([key, value]) => [key, Math.round(value)]));
    return { ...rounded, galleryCached: cached };
  };

  const summary = (entry: GalleryEntry, score: number) => ({
    playerId: entry.playerId, fullName: entry.fullName, photoUrl: entry.photoUrl, teamName: entry.teamName, shirtNumber: entry.shirtNumber,
    confidence: Math.round(score * 10000) / 10000,
  });

  const embedStarted = performance.now();
  let captured: Float32Array;
  try {
    captured = await embedFaceOrFail(await prepareFaceImage(image), { padFirst: true });
  } catch (error) {
    // No usable face in this frame is expected while scanning; it is not an error.
    if (error instanceof ApiError && error.status === 422) return { status: "no_face" as IdentifyStatus, pendingWithoutFace, timings: timings({ embedMs: performance.now() - embedStarted }) };
    throw error;
  }
  const embedMs = performance.now() - embedStarted;
  if (gallery.entries.length === 0) {
    return { status: "unknown" as IdentifyStatus, pendingWithoutFace, message: "Ningún jugador de este partido tiene rostro registrado", timings: timings({ embedMs }) };
  }

  const ranked = gallery.entries.map((entry) => ({ entry, score: cosineSimilarity(captured, entry.embedding) })).sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  const { verifyThreshold, reviewThreshold } = gallery.thresholds;
  const clear = best.score >= verifyThreshold && (!second || best.score - second.score >= IDENTIFY_MARGIN);
  const bestStatus = statuses.get(best.entry.playerId);

  if (clear && best.entry.suspended) return { status: "suspended" as IdentifyStatus, player: summary(best.entry, best.score), pendingWithoutFace, timings: timings({ embedMs }) };
  if (clear && bestStatus === "present") return { status: "already_present" as IdentifyStatus, player: summary(best.entry, best.score), pendingWithoutFace, timings: timings({ embedMs }) };
  if (clear) {
    const registerStarted = performance.now();
    // Written directly instead of through registerCheckIn: the gallery just synced the call-ups, and the
    // extra checks and queries there cost about a second per registration.
    const checkIn = await PlayerCheckIn.findOne({ matchId, playerId: best.entry.playerId });
    if (!checkIn) throw notFound("El jugador no está convocado en este partido");
    if (checkIn.status === "present") {
      return { status: "already_present" as IdentifyStatus, player: summary(best.entry, best.score), pendingWithoutFace, timings: timings({ embedMs }) };
    }
    const confidence = Math.round(best.score * 10000) / 10000;
    const verification = await IdentityVerification.create({
      matchId, playerId: best.entry.playerId, checkInId: checkIn._id, result: "verified", confidence,
      method: "face", operatorName: actor.name, operatorUserId: actor.userId,
    });
    checkIn.set({ status: "present", method: "face", checkedInAt: new Date(), operatorName: actor.name, operatorUserId: actor.userId, verificationId: verification._id });
    await checkIn.save();
    const championshipId = new Types.ObjectId(gallery.championshipId);
    await Promise.all([
      recordAudit(actor, {
        action: "create", entityType: "verification", entityId: verification._id, championshipId,
        summary: `Asistencia por cámara: ${best.entry.fullName}`, changes: { matchId, playerId: best.entry.playerId, confidence },
      }),
      recordAudit(actor, {
        action: "check_in", entityType: "check_in", entityId: checkIn._id, championshipId,
        summary: "Asistencia presente (face)", changes: { matchId, playerId: best.entry.playerId, verificationId: verification._id.toString() },
      }),
    ]);
    return { status: "identified" as IdentifyStatus, player: summary(best.entry, best.score), pendingWithoutFace, timings: timings({ embedMs, registerMs: performance.now() - registerStarted }) };
  }
  if (best.score >= reviewThreshold) {
    const candidates = ranked.filter((item) => item.score >= reviewThreshold && !item.entry.suspended).slice(0, 3);
    return { status: "uncertain" as IdentifyStatus, candidates: candidates.map((item) => summary(item.entry, item.score)), pendingWithoutFace, timings: timings({ embedMs }) };
  }
  return { status: "unknown" as IdentifyStatus, pendingWithoutFace, timings: timings({ embedMs }) };
}

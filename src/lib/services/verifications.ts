import type { Actor } from "@/lib/actor";
import { ApiError, conflict, notFound } from "@/lib/api";
import { registerCheckIn } from "@/lib/services/checkins";
import { recordAudit } from "@/lib/audit";
import { cosineSimilarity, EMBEDDING_VERSION } from "@/lib/faceEngine/embedding";
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
import { Suspension } from "@/models/Suspension";

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
async function loadContext(matchId: string, playerId: string, withEmbedding = false): Promise<MatchPlayerContext> {
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
  const context = await loadContext(matchId, playerId, true);
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

  const captured = await embedFaceOrFail(await prepareFaceImage(image));
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
  const context = await loadContext(matchId, playerId);
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

interface PoolEntry {
  playerId: string;
  fullName: string;
  photoUrl: string;
  teamId: string;
  teamName: string;
  shirtNumber: number | null;
  embedding: Float32Array;
  checkInStatus: "pending" | "present" | "absent" | null;
  suspended: boolean;
}

/**
 * Attendance by camera (1:N): compares a face against every player of both squads and, when one clearly matches,
 * registers them as present (recording the verification). Ambiguous faces return the closest candidates so the
 * operator confirms; suspended players are recognized but never registered.
 */
export async function identifyFace(actor: Actor, matchId: string, image: string) {
  await syncMatchCallUps(matchId);
  const match = await Match.findById(matchId).lean();
  if (!match) throw notFound("Partido no encontrado");
  if (match.status !== "scheduled" && match.status !== "live") throw conflict("El partido no admite registro de asistencia", "match_not_open");
  const championship = await Championship.findById(match.championshipId).lean();
  if (!championship) throw notFound("Campeonato no encontrado");

  const teamIds = [match.homeTeamId, match.awayTeamId];
  const [checkIns, callUps, suspensions, teams] = await Promise.all([
    PlayerCheckIn.find({ matchId: match._id })
      .populate({ path: "playerId", select: "+faceEmbedding fullName photoUrl embeddingVersion" })
      .lean(),
    MatchCallUp.find({ matchId: match._id }).populate({ path: "registrationId", select: "shirtNumber" }).lean(),
    Suspension.find({ teamId: { $in: teamIds }, status: "active" })
      .populate({ path: "playerId", select: "+faceEmbedding fullName photoUrl embeddingVersion" })
      .populate({ path: "registrationId", select: "shirtNumber" })
      .lean(),
    Team.find({ _id: { $in: teamIds } }).select("name").lean(),
  ]);
  const teamName = new Map(teams.map((team) => [team._id.toString(), team.name]));
  const shirtByCallUp = new Map(callUps.map((callUp) => [callUp._id.toString(), (callUp.registrationId as unknown as { shirtNumber?: number } | null)?.shirtNumber ?? null]));

  type PlayerDoc = Pick<IPlayer, "fullName" | "photoUrl" | "embeddingVersion"> & { _id: IPlayer["_id"]; faceEmbedding?: number[] };
  const usable = (player: PlayerDoc | null) =>
    Boolean(player?.faceEmbedding?.length) && (player?.embeddingVersion ?? 1) === EMBEDDING_VERSION;

  const pool: PoolEntry[] = [];
  let pendingWithoutFace = 0;
  for (const checkIn of checkIns) {
    const player = checkIn.playerId as unknown as PlayerDoc | null;
    if (!player || !usable(player)) {
      if (checkIn.status === "pending") pendingWithoutFace += 1;
      continue;
    }
    pool.push({
      playerId: player._id.toString(), fullName: player.fullName, photoUrl: player.photoUrl, teamId: checkIn.teamId.toString(),
      teamName: teamName.get(checkIn.teamId.toString()) ?? "", shirtNumber: shirtByCallUp.get(checkIn.callUpId.toString()) ?? null,
      embedding: Float32Array.from(player.faceEmbedding!), checkInStatus: checkIn.status, suspended: false,
    });
  }
  for (const suspension of suspensions) {
    const player = suspension.playerId as unknown as PlayerDoc | null;
    if (!player || !usable(player)) continue;
    pool.push({
      playerId: player._id.toString(), fullName: player.fullName, photoUrl: player.photoUrl, teamId: suspension.teamId.toString(),
      teamName: teamName.get(suspension.teamId.toString()) ?? "", shirtNumber: (suspension.registrationId as unknown as { shirtNumber?: number } | null)?.shirtNumber ?? null,
      embedding: Float32Array.from(player.faceEmbedding!), checkInStatus: null, suspended: true,
    });
  }

  const summary = (entry: PoolEntry, score: number) => ({
    playerId: entry.playerId, fullName: entry.fullName, photoUrl: entry.photoUrl, teamName: entry.teamName, shirtNumber: entry.shirtNumber,
    confidence: Math.round(score * 10000) / 10000,
  });

  let captured: Float32Array;
  try {
    captured = await embedFaceOrFail(await prepareFaceImage(image));
  } catch (error) {
    // No usable face in this frame is expected while scanning; it is not an error.
    if (error instanceof ApiError && error.status === 422) return { status: "no_face" as IdentifyStatus, pendingWithoutFace };
    throw error;
  }
  if (pool.length === 0) return { status: "unknown" as IdentifyStatus, pendingWithoutFace, message: "Ningún jugador de este partido tiene rostro registrado" };

  const ranked = pool.map((entry) => ({ entry, score: cosineSimilarity(captured, entry.embedding) })).sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  const clear = best.score >= championship.rules.verifyThreshold && (!second || best.score - second.score >= IDENTIFY_MARGIN);

  if (clear && best.entry.suspended) return { status: "suspended" as IdentifyStatus, player: summary(best.entry, best.score), pendingWithoutFace };
  if (clear && best.entry.checkInStatus === "present") return { status: "already_present" as IdentifyStatus, player: summary(best.entry, best.score), pendingWithoutFace };
  if (clear) {
    const checkIn = await PlayerCheckIn.findOne({ matchId: match._id, playerId: best.entry.playerId });
    if (!checkIn) throw notFound("El jugador no está convocado en este partido");
    const verification = await IdentityVerification.create({
      matchId, playerId: best.entry.playerId, checkInId: checkIn._id, result: "verified", confidence: Math.round(best.score * 10000) / 10000,
      method: "face", operatorName: actor.name, operatorUserId: actor.userId,
    });
    await registerCheckIn(actor, matchId, { playerId: best.entry.playerId, status: "present", verificationId: verification._id.toString() });
    await recordAudit(actor, {
      action: "create", entityType: "verification", entityId: verification._id, championshipId: match.championshipId,
      summary: `Asistencia por cámara: ${best.entry.fullName}`, changes: { matchId, playerId: best.entry.playerId, confidence: verification.confidence },
    });
    return { status: "identified" as IdentifyStatus, player: summary(best.entry, best.score), pendingWithoutFace };
  }
  if (best.score >= championship.rules.reviewThreshold) {
    const candidates = ranked.filter((item) => item.score >= championship.rules.reviewThreshold && !item.entry.suspended).slice(0, 3);
    return { status: "uncertain" as IdentifyStatus, candidates: candidates.map((item) => summary(item.entry, item.score)), pendingWithoutFace };
  }
  return { status: "unknown" as IdentifyStatus, pendingWithoutFace };
}

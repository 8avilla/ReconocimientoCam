import { EMBEDDING_VERSION } from "@/lib/faceEngine/embedding";
import { notFound } from "@/lib/api";
import { syncMatchCallUps } from "@/lib/services/callups";
import { getSystemSettings } from "@/lib/services/systemSettings";
import { Match } from "@/models/Match";
import { MatchCallUp } from "@/models/MatchCallUp";
import { IPlayer } from "@/models/Player";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { Suspension } from "@/models/Suspension";
import { Team } from "@/models/Team";

export interface GalleryEntry {
  playerId: string;
  fullName: string;
  photoUrl: string;
  teamId: string;
  teamName: string;
  shirtNumber: number | null;
  embedding: Float32Array;
  /** Suspended players are recognized (to warn) but never registered. */
  suspended: boolean;
}

/** What is needed to recognize faces at a match, prepared once instead of on every camera frame. */
export interface Gallery {
  championshipId: string;
  matchStatus: string;
  thresholds: { verifyThreshold: number; reviewThreshold: number };
  entries: GalleryEntry[];
  /** Called-up players without a usable registered face (they need Verificar or Manual). */
  withoutFace: string[];
  builtAt: number;
}

const TTL_MS = 60_000;
// On globalThis so every route bundle (and hot reloads in development) shares one cache and its invalidation.
const globalWithCache = globalThis as typeof globalThis & { _faceGalleries?: Map<string, Gallery> };
const cache = (globalWithCache._faceGalleries ??= new Map<string, Gallery>());

/** Forget the prepared galleries: call it when faces, squads or suspensions change. */
export function invalidateGalleries(): void {
  cache.clear();
}

type PlayerDoc = Pick<IPlayer, "fullName" | "photoUrl" | "embeddingVersion"> & { _id: IPlayer["_id"]; faceEmbedding?: number[] };
const usable = (player: PlayerDoc | null): boolean =>
  Boolean(player?.faceEmbedding?.length) && (player?.embeddingVersion ?? 1) === EMBEDDING_VERSION;

async function buildGallery(matchId: string): Promise<Gallery> {
  await syncMatchCallUps(matchId);
  const match = await Match.findById(matchId).lean();
  if (!match) throw notFound("Partido no encontrado");
  const thresholds = await getSystemSettings();

  const teamIds = [match.homeTeamId, match.awayTeamId];
  const [checkIns, callUps, suspensions, teams] = await Promise.all([
    PlayerCheckIn.find({ matchId: match._id }).populate({ path: "playerId", select: "+faceEmbedding fullName photoUrl embeddingVersion" }).lean(),
    MatchCallUp.find({ matchId: match._id }).populate({ path: "registrationId", select: "shirtNumber" }).lean(),
    Suspension.find({ teamId: { $in: teamIds }, status: "active" })
      .populate({ path: "playerId", select: "+faceEmbedding fullName photoUrl embeddingVersion" })
      .populate({ path: "registrationId", select: "shirtNumber" })
      .lean(),
    Team.find({ _id: { $in: teamIds } }).select("name").lean(),
  ]);
  const teamName = new Map(teams.map((team) => [team._id.toString(), team.name]));
  const shirtByCallUp = new Map(callUps.map((callUp) => [callUp._id.toString(), (callUp.registrationId as unknown as { shirtNumber?: number } | null)?.shirtNumber ?? null]));

  const entries: GalleryEntry[] = [];
  const withoutFace: string[] = [];
  for (const checkIn of checkIns) {
    const player = checkIn.playerId as unknown as PlayerDoc | null;
    if (!player) continue;
    if (!usable(player)) {
      withoutFace.push(player._id.toString());
      continue;
    }
    entries.push({
      playerId: player._id.toString(), fullName: player.fullName, photoUrl: player.photoUrl, teamId: checkIn.teamId.toString(),
      teamName: teamName.get(checkIn.teamId.toString()) ?? "", shirtNumber: shirtByCallUp.get(checkIn.callUpId.toString()) ?? null,
      embedding: Float32Array.from(player.faceEmbedding!), suspended: false,
    });
  }
  for (const suspension of suspensions) {
    const player = suspension.playerId as unknown as PlayerDoc | null;
    if (!player || !usable(player)) continue;
    entries.push({
      playerId: player._id.toString(), fullName: player.fullName, photoUrl: player.photoUrl, teamId: suspension.teamId.toString(),
      teamName: teamName.get(suspension.teamId.toString()) ?? "",
      shirtNumber: (suspension.registrationId as unknown as { shirtNumber?: number } | null)?.shirtNumber ?? null,
      embedding: Float32Array.from(player.faceEmbedding!), suspended: true,
    });
  }
  return {
    championshipId: match.championshipId.toString(),
    matchStatus: match.status,
    thresholds,
    entries, withoutFace, builtAt: Date.now(),
  };
}

/** Gallery of a match, from memory when it was prepared recently. */
export async function getGallery(matchId: string): Promise<{ gallery: Gallery; cached: boolean }> {
  const found = cache.get(matchId);
  if (found && Date.now() - found.builtAt < TTL_MS) return { gallery: found, cached: true };
  const gallery = await buildGallery(matchId);
  cache.set(matchId, gallery);
  return { gallery, cached: false };
}

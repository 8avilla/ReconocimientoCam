import mongoose, { Types } from "mongoose";
import { conflict, notFound } from "@/lib/api";
import { deleteImage } from "@/lib/azureBlob";
import { Championship } from "@/models/Championship";

/** Default days a per-user demo lives before it is purged. */
export const DEMO_TTL_DAYS = 7;

type Doc = Record<string, unknown> & { _id: Types.ObjectId };
type IdMap = Map<string, Types.ObjectId>;

/** Collections whose documents hang from a championship through `championshipId`, in the order they are removed. */
const CHILD_COLLECTIONS = [
  "fines", "suspensions", "matchevents", "matchcallups", "playercheckins", "identityverifications",
  "matches", "ties", "matchdays", "phases", "teamregistrations", "teams", "auditlogs",
];

const db = () => mongoose.connection.db!;
const col = (name: string) => db().collection<Doc>(name);
const remap = (map: IdMap, id?: Types.ObjectId | null) => (id ? map.get(id.toString()) ?? id : undefined);
/** Missing references stay absent, not null: partial unique indexes (e.g. fines.eventId) treat null as a value. */
const strip = (doc: Record<string, unknown>) => Object.fromEntries(Object.entries(doc).filter(([, value]) => value !== undefined && value !== null));
async function insert(name: string, docs: Doc[]) {
  if (docs.length) await col(name).insertMany(docs.map((doc) => strip(doc) as Doc));
}

/** The demo the user already has (not expired), if any. */
export async function findActiveDemo(userId: string) {
  return Championship.findOne({ demoOwnerUserId: userId, demoExpiresAt: { $gt: new Date() } }).lean();
}

/**
 * Clones the demo template for one user: same teams, players, fixtures and results, with the user as owner.
 * Blob names are cleared on the copy, so deleting the demo (or an image in it) never removes the template's images,
 * and no biometric data is carried over.
 */
export async function createDemoForUser(userId: string, days = DEMO_TTL_DAYS) {
  await purgeExpiredDemos();
  const existing = await findActiveDemo(userId);
  if (existing) return existing;

  const template = await col("championships").findOne({ isDemoTemplate: true });
  if (!template) throw notFound("Todavía no hay una demo disponible");

  const owner = new Types.ObjectId(userId);
  const newId = new Types.ObjectId();
  const created: Array<[string, Types.ObjectId[]]> = [];
  const track = (name: string, docs: Doc[]) => created.push([name, docs.map((doc) => doc._id)]);

  try {
    const { _id: _templateId, isDemoTemplate: _flag, slug: _slug, ...rest } = template;
    void _templateId; void _flag; void _slug;
    const code = newId.toHexString().slice(-5);
    const championship: Doc = {
      ...rest, _id: newId, name: `${template.name} (demo ${code})`, visibility: "private", logoBlobName: "",
      ownerUserId: owner, organizerUserIds: [], organizerInviteEmails: [],
      demoOwnerUserId: owner, demoExpiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      createdAt: new Date(), updatedAt: new Date(),
    };
    await insert("championships", [championship]);
    created.push(["championships", [newId]]);

    const teamMap: IdMap = new Map(), playerMap: IdMap = new Map(), regMap: IdMap = new Map(), phaseMap: IdMap = new Map();
    const dayMap: IdMap = new Map(), tieMap: IdMap = new Map(), matchMap: IdMap = new Map(), eventMap: IdMap = new Map();
    const fresh = (map: IdMap, old: Types.ObjectId) => {
      const id = new Types.ObjectId();
      map.set(old.toString(), id);
      return id;
    };

    const teams = (await col("teams").find({ championshipId: template._id }).toArray()).map((team) => ({
      ...team, _id: fresh(teamMap, team._id), championshipId: newId, shieldBlobName: "",
      staff: ((team.staff as Doc[] | undefined) ?? []).map((member) => ({ ...member, _id: new Types.ObjectId() })),
    }));
    await insert("teams", teams);
    track("teams", teams);

    const regs = await col("teamregistrations").find({ championshipId: template._id }).toArray();
    const sourcePlayers = await col("players").find({ _id: { $in: regs.map((reg) => reg.playerId as Types.ObjectId) } }).toArray();
    const players = sourcePlayers.map((player) => {
      const { faceEmbedding, embeddingVersion, biometricConsentAt, facePhotoUrl, facePhotoBlobName, documentId, ...keep } = player;
      void faceEmbedding; void embeddingVersion; void biometricConsentAt; void facePhotoUrl; void facePhotoBlobName; void documentId;
      return { ...keep, _id: fresh(playerMap, player._id), publicId: `PLR-${new Types.ObjectId().toHexString().slice(-12).toUpperCase()}`, photoBlobName: "", photos: [] };
    });
    await insert("players", players);
    track("players", players);

    const newRegs = regs.map((reg) => ({
      ...reg, _id: fresh(regMap, reg._id), championshipId: newId, teamId: remap(teamMap, reg.teamId as Types.ObjectId), playerId: remap(playerMap, reg.playerId as Types.ObjectId),
    }));
    await insert("teamregistrations", newRegs as Doc[]);
    track("teamregistrations", newRegs as Doc[]);

    const phases = (await col("phases").find({ championshipId: template._id }).toArray()).map((phase) => ({
      ...phase, _id: fresh(phaseMap, phase._id), championshipId: newId,
      teamIds: ((phase.teamIds as Types.ObjectId[] | undefined) ?? []).map((id) => remap(teamMap, id)),
      groups: ((phase.groups as Array<{ teamIds?: Types.ObjectId[] }> | undefined) ?? []).map((group) => ({ ...group, teamIds: (group.teamIds ?? []).map((id) => remap(teamMap, id)) })),
    }));
    await insert("phases", phases as Doc[]);
    track("phases", phases as Doc[]);

    const matchdays = (await col("matchdays").find({ championshipId: template._id }).toArray()).map((day) => ({
      ...day, _id: fresh(dayMap, day._id), championshipId: newId, phaseId: remap(phaseMap, day.phaseId as Types.ObjectId),
    }));
    await insert("matchdays", matchdays as Doc[]);
    track("matchdays", matchdays as Doc[]);

    const ties = (await col("ties").find({ championshipId: template._id }).toArray()).map((tie) => ({
      ...tie, _id: fresh(tieMap, tie._id), championshipId: newId, phaseId: remap(phaseMap, tie.phaseId as Types.ObjectId),
      homeTeamId: remap(teamMap, tie.homeTeamId as Types.ObjectId), awayTeamId: remap(teamMap, tie.awayTeamId as Types.ObjectId), winnerTeamId: remap(teamMap, tie.winnerTeamId as Types.ObjectId),
    }));
    await insert("ties", ties as Doc[]);
    track("ties", ties as Doc[]);

    const matches = (await col("matches").find({ championshipId: template._id }).toArray()).map((match) => ({
      ...match, _id: fresh(matchMap, match._id), championshipId: newId, phaseId: remap(phaseMap, match.phaseId as Types.ObjectId),
      matchdayId: remap(dayMap, match.matchdayId as Types.ObjectId), tieId: remap(tieMap, match.tieId as Types.ObjectId),
      homeTeamId: remap(teamMap, match.homeTeamId as Types.ObjectId), awayTeamId: remap(teamMap, match.awayTeamId as Types.ObjectId),
      walkoverWinnerTeamId: remap(teamMap, match.walkoverWinnerTeamId as Types.ObjectId),
    }));
    await insert("matches", matches as Doc[]);
    track("matches", matches as Doc[]);

    const sourceEvents = await col("matchevents").find({ championshipId: template._id }).toArray();
    sourceEvents.forEach((event) => fresh(eventMap, event._id));
    const events = sourceEvents.map((event) => ({
      ...event, _id: eventMap.get(event._id.toString())!, championshipId: newId, matchId: remap(matchMap, event.matchId as Types.ObjectId), teamId: remap(teamMap, event.teamId as Types.ObjectId),
      playerId: remap(playerMap, event.playerId as Types.ObjectId), relatedPlayerId: remap(playerMap, event.relatedPlayerId as Types.ObjectId), linkedEventId: remap(eventMap, event.linkedEventId as Types.ObjectId),
    }));
    await insert("matchevents", events as Doc[]);
    track("matchevents", events as Doc[]);

    const suspensions = (await col("suspensions").find({ championshipId: template._id }).toArray()).map((item) => ({
      ...item, _id: new Types.ObjectId(), championshipId: newId, teamId: remap(teamMap, item.teamId as Types.ObjectId), playerId: remap(playerMap, item.playerId as Types.ObjectId),
      registrationId: remap(regMap, item.registrationId as Types.ObjectId), sourceMatchId: remap(matchMap, item.sourceMatchId as Types.ObjectId), sourceEventId: remap(eventMap, item.sourceEventId as Types.ObjectId),
    }));
    await insert("suspensions", suspensions as Doc[]);
    track("suspensions", suspensions as Doc[]);

    const fines = (await col("fines").find({ championshipId: template._id }).toArray()).map((fine) => ({
      ...fine, _id: new Types.ObjectId(), championshipId: newId, teamId: remap(teamMap, fine.teamId as Types.ObjectId), playerId: remap(playerMap, fine.playerId as Types.ObjectId),
      matchId: remap(matchMap, fine.matchId as Types.ObjectId), eventId: remap(eventMap, fine.eventId as Types.ObjectId),
      payments: ((fine.payments as Doc[] | undefined) ?? []).map((payment) => ({ ...payment, _id: new Types.ObjectId(), receiptBlobName: "" })),
    }));
    await insert("fines", fines as Doc[]);
    track("fines", fines as Doc[]);
  } catch (error) {
    for (const [name, ids] of created) await col(name).deleteMany({ _id: { $in: ids } });
    throw error;
  }
  return Championship.findById(newId).lean();
}

/** Removes a demo championship with everything in it, and the players that only existed inside it. */
export async function deleteDemo(championshipId: Types.ObjectId) {
  const champ = await Championship.findById(championshipId).lean();
  if (!champ?.demoOwnerUserId) throw conflict("Solo se pueden eliminar torneos de demostración", "not_demo");

  const regs = await col("teamregistrations").find({ championshipId }, { projection: { playerId: 1 } }).toArray();
  const playerIds = [...new Set(regs.map((reg) => String(reg.playerId)))].map((id) => new Types.ObjectId(id));
  const blobs: string[] = [champ.logoBlobName];
  const teams = await col("teams").find({ championshipId }, { projection: { shieldBlobName: 1 } }).toArray();
  blobs.push(...teams.map((team) => String(team.shieldBlobName ?? "")));
  const fines = await col("fines").find({ championshipId }, { projection: { payments: 1 } }).toArray();
  for (const fine of fines) blobs.push(...((fine.payments as Array<{ receiptBlobName?: string }> | undefined) ?? []).map((payment) => payment.receiptBlobName ?? ""));

  for (const name of CHILD_COLLECTIONS) await col(name).deleteMany({ championshipId });

  // A player still registered somewhere else is a real one that happened to be signed up here: it stays.
  const stillRegistered = await col("teamregistrations").distinct("playerId", { playerId: { $in: playerIds } });
  const keep = new Set(stillRegistered.map(String));
  const orphanIds = playerIds.filter((id) => !keep.has(id.toString()));
  const orphans = await col("players").find({ _id: { $in: orphanIds } }, { projection: { photoBlobName: 1, facePhotoBlobName: 1, photos: 1 } }).toArray();
  for (const player of orphans) {
    blobs.push(String(player.photoBlobName ?? ""), String(player.facePhotoBlobName ?? ""));
    blobs.push(...((player.photos as Array<{ blobName?: string }> | undefined) ?? []).map((photo) => photo.blobName ?? ""));
  }
  await col("players").deleteMany({ _id: { $in: orphanIds } });
  await Championship.deleteOne({ _id: championshipId });

  await Promise.all(blobs.filter(Boolean).map((blob) => deleteImage(blob).catch((error) => console.error("Failed to delete demo image:", error))));
}

/** Purges every demo past its expiry. Runs lazily whenever someone creates a demo, or from `npm run demo:cleanup`. */
export async function purgeExpiredDemos() {
  const expired = await Championship.find({ demoExpiresAt: { $lte: new Date() } }, "_id").lean();
  for (const { _id } of expired) await deleteDemo(_id);
  return expired.length;
}

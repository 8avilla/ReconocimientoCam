import { invalidateGalleries } from "@/lib/services/faceGallery";
import { randomBytes } from "crypto";
import sharp from "sharp";
import type { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { badRequest, conflict, notFound, unprocessable } from "@/lib/api";
import { requireOrganizerOfPlayer } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { deleteImage, uploadImage } from "@/lib/azureBlob";
import { EMBEDDING_VERSION, embedFaceFromPhoto, FaceDetectionError } from "@/lib/faceEngine/embedding";
import { dataUrlToBuffer } from "@/lib/faceEngine/store";
import { IPlayerPhoto, Player } from "@/models/Player";

/** `photos` is a plain array in the shared `IPlayer` type (correct for `.lean()` reads elsewhere); a
 * hydrated document's is really a Mongoose `DocumentArray` with `.id()`/subdocument `push()`. */
const photosOf = (player: { photos: IPlayerPhoto[] }) => player.photos as unknown as Types.DocumentArray<IPlayerPhoto>;

/** Opaque, non-guessable identifier used inside the QR code. */
export function generatePublicId(): string {
  return `PLR-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** Re-encodes an upload as a bounded JPEG (also strips metadata and rejects non-images). */
async function normalizeImage(buffer: Buffer, size: number, format: "jpeg" | "png"): Promise<Buffer> {
  try {
    const pipeline = sharp(buffer).rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true });
    return format === "png" ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 88 }).toBuffer();
  } catch {
    throw badRequest("La imagen no es válida");
  }
}

/** Decodes and re-encodes a captured face image so enrollment and verification see identical input. */
export async function prepareFaceImage(dataUrl: string): Promise<Buffer> {
  return normalizeImage(dataUrlToBuffer(dataUrl), 640, "jpeg");
}

/** Decodes and re-encodes the looser "ID card" shot (same capture, more headroom around the face). */
export async function prepareCarnetImage(dataUrl: string): Promise<Buffer> {
  return normalizeImage(dataUrlToBuffer(dataUrl), 640, "jpeg");
}

/** Detects, aligns and embeds the face of a photo; a missing or ambiguous face becomes a 422. */
export async function embedFaceOrFail(photo: Buffer, options: { padFirst?: boolean } = {}): Promise<Float32Array> {
  try {
    return (await embedFaceFromPhoto(photo, options)).embedding;
  } catch (error) {
    if (error instanceof FaceDetectionError) throw unprocessable(error.message, error.reason);
    throw error;
  }
}

export async function normalizeShieldImage(dataUrl: string): Promise<Buffer> {
  return normalizeImage(dataUrlToBuffer(dataUrl), 512, "png");
}

/**
 * Enrolls the official face of a player, from a single shot the browser sends as two crops: a tight
 * one (`image`, the embedding's source, also kept as the reference photo for manual review) and a
 * looser one (`carnetImage`, shown everywhere else as the player's photo). Older clients that only
 * send `image` get the same photo in both places, like before.
 */
export async function enrollPlayerFace(
  actor: Actor,
  playerId: string,
  input: { image: string; carnetImage?: string }
) {
  invalidateGalleries();
  await requireOrganizerOfPlayer(actor, playerId);
  const player = await Player.findById(playerId);
  if (!player) throw notFound("Jugador no encontrado");

  const facePhoto = await prepareFaceImage(input.image);
  const embedding = await embedFaceOrFail(facePhoto);
  const [faceUploaded, carnetUploaded] = await Promise.all([
    uploadImage(facePhoto, "players/faces"),
    uploadImage(await prepareCarnetImage(input.carnetImage ?? input.image), "players/photos"),
  ]);

  const previousFaceBlob = player.facePhotoBlobName;
  const previousCarnetBlob = player.photoBlobName;
  player.set({
    photoUrl: carnetUploaded.url,
    photoBlobName: carnetUploaded.blobName,
    facePhotoUrl: faceUploaded.url,
    facePhotoBlobName: faceUploaded.blobName,
    faceEmbedding: Array.from(embedding),
    embeddingVersion: EMBEDDING_VERSION,
    biometricConsentAt: player.biometricConsentAt ?? new Date(),
  });
  await player.save();

  for (const blobName of new Set([previousFaceBlob, previousCarnetBlob].filter(Boolean))) {
    deleteImage(blobName!).catch((error) => console.error("Failed to delete previous face image:", error));
  }

  await recordAudit(actor, {
    action: "face_enroll",
    entityType: "player",
    entityId: player._id,
    summary: `Rostro registrado para ${player.fullName}`,
  });
  return { photoUrl: player.photoUrl, biometricConsentAt: player.biometricConsentAt };
}

/** Removes the photo, embedding and consent of a player (privacy / retention). */
export async function removePlayerFace(actor: Actor, playerId: string) {
  invalidateGalleries();
  await requireOrganizerOfPlayer(actor, playerId);
  const player = await Player.findById(playerId);
  if (!player) throw notFound("Jugador no encontrado");

  const blobNames = [player.photoBlobName, player.facePhotoBlobName].filter(Boolean) as string[];
  player.set({ photoUrl: "", photoBlobName: "", facePhotoUrl: "", facePhotoBlobName: "" });
  player.faceEmbedding = undefined;
  player.embeddingVersion = undefined;
  player.biometricConsentAt = undefined;
  await player.save();

  for (const blobName of new Set(blobNames)) {
    await deleteImage(blobName).catch((error) => console.error("Failed to delete face image:", error));
  }
  await recordAudit(actor, {
    action: "face_remove",
    entityType: "player",
    entityId: player._id,
    summary: `Datos biométricos eliminados de ${player.fullName}`,
  });
}

export async function uploadShieldImage(dataUrl: string) {
  return uploadImage(await normalizeShieldImage(dataUrl), "teams/shields", "image/png");
}

export async function uploadChampionshipLogo(dataUrl: string) {
  return uploadImage(await normalizeShieldImage(dataUrl), "championships/logos", "image/png");
}

/** Higher resolution than the biometric photos: these are meant for identification and posters. */
async function normalizeGalleryPhoto(dataUrl: string): Promise<Buffer> {
  return normalizeImage(dataUrlToBuffer(dataUrl), 1280, "jpeg");
}

const MAX_GALLERY_PHOTOS = 8;

/** Adds a general photo of the player: no face detection, no embedding, unrelated to biometric consent. */
export async function addPlayerPhoto(actor: Actor, playerId: string, image: string) {
  await requireOrganizerOfPlayer(actor, playerId);
  const player = await Player.findById(playerId);
  if (!player) throw notFound("Jugador no encontrado");
  if (player.photos.length >= MAX_GALLERY_PHOTOS) {
    throw conflict(`Máximo ${MAX_GALLERY_PHOTOS} fotos por jugador; elimina alguna antes de agregar otra`, "gallery_full");
  }

  const uploaded = await uploadImage(await normalizeGalleryPhoto(image), "players/gallery");
  const photos = photosOf(player);
  photos.push({ url: uploaded.url, blobName: uploaded.blobName, uploadedAt: new Date() } as IPlayerPhoto);
  await player.save();

  await recordAudit(actor, {
    action: "update",
    entityType: "player",
    entityId: player._id,
    summary: `Foto agregada a ${player.fullName}`,
  });
  return photos[photos.length - 1];
}

/** Removes one general photo of the player. If it was in use as the ID card photo, that goes blank too. */
export async function removePlayerPhoto(actor: Actor, playerId: string, photoId: string) {
  await requireOrganizerOfPlayer(actor, playerId);
  const player = await Player.findById(playerId);
  if (!player) throw notFound("Jugador no encontrado");
  const photo = photosOf(player).id(photoId);
  if (!photo) throw notFound("Foto no encontrada");

  const blobName = photo.blobName;
  const wasCarnet = Boolean(blobName) && player.photoBlobName === blobName;
  photo.deleteOne();
  if (wasCarnet) player.set({ photoUrl: "", photoBlobName: "" });
  await player.save();
  await deleteImage(blobName).catch((error) => console.error("Failed to delete player photo:", error));

  await recordAudit(actor, {
    action: "update",
    entityType: "player",
    entityId: player._id,
    summary: `Foto eliminada de ${player.fullName}`,
  });
}

/**
 * Uses one of the general photos as the ID card / avatar photo. Only `photoUrl`/`photoBlobName`
 * change — the biometric photo, embedding and consent are never touched by this.
 */
export async function setPlayerCarnetPhoto(actor: Actor, playerId: string, photoId: string) {
  await requireOrganizerOfPlayer(actor, playerId);
  const player = await Player.findById(playerId);
  if (!player) throw notFound("Jugador no encontrado");
  const photo = photosOf(player).id(photoId);
  if (!photo) throw notFound("Foto no encontrada");

  const previousBlob = player.photoBlobName;
  player.set({ photoUrl: photo.url, photoBlobName: photo.blobName });
  await player.save();

  // The old carnet blob is only deleted if the gallery isn't also pointing to it (it's independent otherwise).
  const stillInGallery = photosOf(player).some((item) => item.blobName === previousBlob);
  if (previousBlob && previousBlob !== photo.blobName && !stillInGallery) {
    deleteImage(previousBlob).catch((error) => console.error("Failed to delete previous carnet photo:", error));
  }

  await recordAudit(actor, {
    action: "update",
    entityType: "player",
    entityId: player._id,
    summary: `Foto de carnet actualizada (desde la galería) para ${player.fullName}`,
  });
  return { photoUrl: player.photoUrl };
}

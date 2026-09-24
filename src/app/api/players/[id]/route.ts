import { conflict, json, notFound, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { diffChanges, recordAudit } from "@/lib/audit";
import { deleteImage } from "@/lib/azureBlob";
import { organizedPlayerIds, requireOrganizerOfPlayer } from "@/lib/permissions";
import { playerUpdateSchema } from "@/lib/validation/schemas";
import { IPlayer, Player } from "@/models/Player";
import { PlayerCheckIn } from "@/models/PlayerCheckIn";
import { TeamRegistration } from "@/models/TeamRegistration";

type Params = { id: string };

export const GET = route<Params>(async (request, { id }) => {
  const player = await Player.findById(id).lean();
  if (!player) throw notFound("Jugador no encontrado");
  const registrations = await TeamRegistration.find({ playerId: id })
    .sort({ createdAt: -1 })
    .populate({ path: "teamId", select: "name shieldUrl" })
    .populate({ path: "championshipId", select: "name season" })
    .lean();

  const { documentId, birthDate, ...rest } = player;
  const organized = await organizedPlayerIds(getActor(request), [id]);
  const sensitive = organized.has(id) ? { documentId, birthDate } : {};
  // `biometricConsentAt` alone is the real signal: it's set/cleared only by enrolling or explicitly
  // removing the face (never by deleting a gallery photo), unlike `photoUrl` — the carnet/profile
  // picture — which can go empty on its own (e.g. its gallery photo got deleted) without touching
  // the actual biometric data (embedding, consent, face photo).
  return json({ ...rest, ...sensitive, hasFace: Boolean(player.biometricConsentAt), registrations });
});

export const PATCH = route<Params>(async (request, { id }) => {
  const input = await parseBody(request, playerUpdateSchema);
  const player = await Player.findById(id);
  if (!player) throw notFound("Jugador no encontrado");
  await requireOrganizerOfPlayer(getActor(request), id);

  const before = player.toObject() as IPlayer;
  player.set(input);
  await player.save();

  const changes = diffChanges(before, input, ["fullName", "documentId", "birthDate"]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(getActor(request), {
      action: "update",
      entityType: "player",
      entityId: player._id,
      summary: `Jugador actualizado: ${player.fullName}`,
      changes,
    });
  }
  return json(player);
});

export const DELETE = route<Params>(async (request, { id }) => {
  const player = await Player.findById(id);
  if (!player) throw notFound("Jugador no encontrado");
  await requireOrganizerOfPlayer(getActor(request), id);

  const [registrations, checkIns] = await Promise.all([
    TeamRegistration.exists({ playerId: id }),
    PlayerCheckIn.exists({ playerId: id }),
  ]);
  if (registrations || checkIns) {
    throw conflict("El jugador tiene inscripciones o asistencias; no se puede eliminar", "player_in_use");
  }
  await player.deleteOne();
  if (player.photoBlobName) {
    await deleteImage(player.photoBlobName).catch((error) => console.error("Failed to delete face image:", error));
  }
  await recordAudit(getActor(request), {
    action: "delete",
    entityType: "player",
    entityId: player._id,
    summary: `Jugador eliminado: ${player.fullName}`,
  });
  return json({ ok: true });
});

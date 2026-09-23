import { ApiError, notFound } from "@/lib/api";
import type { Actor } from "@/lib/actor";
import { Championship } from "@/models/Championship";
import { LIVE_REGISTRATION_STATUSES, TeamRegistration } from "@/models/TeamRegistration";

interface Owned {
  ownerUserId?: { toString(): string } | null;
  organizerUserIds?: { toString(): string }[] | null;
}

/**
 * Throws 401 (signed out) or 403 (signed in but not an organizer of this championship) unless the actor is
 * an admin or an organizer (owner or invited co-organizer) of the given championship. Callers pass whatever
 * they already loaded that carries `ownerUserId`/`organizerUserIds` (usually the championship document
 * itself, sometimes a phase or match's populated championship) — no extra query when that is at hand.
 */
export function requireOrganizer(actor: Actor, owned: Owned): void {
  if (actor.isAdmin) return;
  if (!actor.userId) throw new ApiError(401, "Inicia sesión para hacer esto", "unauthenticated");
  const isOwner = owned.ownerUserId?.toString() === actor.userId;
  const isOrganizer = owned.organizerUserIds?.some((id) => id.toString() === actor.userId) ?? false;
  if (!isOwner && !isOrganizer) throw new ApiError(403, "No administras este campeonato", "forbidden");
}

/** Throws 401/403 unless the actor is an admin. */
export function requireAdmin(actor: Actor): void {
  if (actor.isAdmin) return;
  if (!actor.userId) throw new ApiError(401, "Inicia sesión para hacer esto", "unauthenticated");
  throw new ApiError(403, "Solo un administrador puede hacer esto", "forbidden");
}

/** Loads just enough of the championship to check who organizes it, and throws unless the actor does. */
export async function requireOrganizerOfChampionship(actor: Actor, championshipId: string | { toString(): string }): Promise<void> {
  const championship = await Championship.findById(championshipId.toString()).select("ownerUserId organizerUserIds").lean();
  if (!championship) throw notFound("Campeonato no encontrado");
  requireOrganizer(actor, championship);
}

/**
 * A player is not scoped to one championship (they can be registered in several). Throws unless the actor
 * organizes at least one championship where this player currently has a live registration.
 */
export async function requireOrganizerOfPlayer(actor: Actor, playerId: string): Promise<void> {
  if (actor.isAdmin) return;
  if (!actor.userId) throw new ApiError(401, "Inicia sesión para hacer esto", "unauthenticated");
  const championshipIds = await TeamRegistration.distinct("championshipId", { playerId, status: { $in: LIVE_REGISTRATION_STATUSES } });
  if (championshipIds.length === 0) throw new ApiError(403, "Este jugador no tiene una inscripción vigente que administres", "forbidden");
  const organizes = await Championship.exists({
    _id: { $in: championshipIds },
    $or: [{ ownerUserId: actor.userId }, { organizerUserIds: actor.userId }],
  });
  if (!organizes) throw new ApiError(403, "No administras el campeonato de este jugador", "forbidden");
}

/**
 * Non-throwing, batch version of `requireOrganizerOfPlayer`: which of the given players does the actor
 * organize (admin sees all, a signed-out visitor sees none). Used to decide whether to include a
 * player's sensitive fields (document id, birth date) in a read response, not to block a request.
 */
export async function organizedPlayerIds(actor: Actor, playerIds: readonly string[]): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();
  if (actor.isAdmin) return new Set(playerIds);
  if (!actor.userId) return new Set();

  const organizedChampionshipIds = await Championship.distinct("_id", {
    $or: [{ ownerUserId: actor.userId }, { organizerUserIds: actor.userId }],
  });
  if (organizedChampionshipIds.length === 0) return new Set();

  const rows = await TeamRegistration.find({
    playerId: { $in: playerIds },
    championshipId: { $in: organizedChampionshipIds },
    status: { $in: LIVE_REGISTRATION_STATUSES },
  })
    .select("playerId")
    .lean();
  return new Set(rows.map((row) => row.playerId.toString()));
}

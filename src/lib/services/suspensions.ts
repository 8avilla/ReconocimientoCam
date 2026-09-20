import type { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { conflict, notFound } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import type { SuspensionReason } from "@/lib/constants";
import { IMatch } from "@/models/Match";
import { ISuspension, Suspension } from "@/models/Suspension";
import { TeamRegistration } from "@/models/TeamRegistration";

export interface CreateSuspensionInput {
  championshipId: Types.ObjectId | string;
  teamId: Types.ObjectId | string;
  playerId: Types.ObjectId | string;
  reason: SuspensionReason;
  matchesToServe: number;
  sourceMatchId?: Types.ObjectId | string;
  sourceEventId?: Types.ObjectId | string;
  note?: string;
}

/** Once no active suspension is left, a registration that was suspended by the system becomes active again. */
async function releaseRegistration(registrationId: Types.ObjectId) {
  const stillBanned = await Suspension.exists({ registrationId, status: "active" });
  if (!stillBanned) await TeamRegistration.updateOne({ _id: registrationId, status: "suspended" }, { status: "active" });
}

export async function createSuspension(actor: Actor, input: CreateSuspensionInput) {
  const registration = await TeamRegistration.findOne({
    championshipId: input.championshipId,
    playerId: input.playerId,
    status: { $in: ["pending", "active", "suspended"] },
  });
  if (!registration) throw notFound("El jugador no tiene una inscripción vigente en este campeonato");

  const suspension = await Suspension.create({
    ...input,
    registrationId: registration._id,
    createdBy: actor.name,
  });
  if (registration.status === "active") {
    registration.status = "suspended";
    await registration.save();
  }

  await recordAudit(actor, {
    action: "create",
    entityType: "suspension",
    entityId: suspension._id,
    championshipId: input.championshipId,
    summary: `Suspensión (${input.reason}) de ${input.matchesToServe} partido(s)`,
    changes: { playerId: input.playerId.toString(), sourceEventId: input.sourceEventId?.toString(), note: input.note },
  });
  return suspension;
}

export async function liftSuspension(actor: Actor, suspensionId: string, note?: string) {
  const suspension = await Suspension.findById(suspensionId);
  if (!suspension) throw notFound("Suspensión no encontrada");
  if (suspension.status !== "active") throw conflict("La suspensión ya no está vigente", "suspension_not_active");

  suspension.set({ status: "lifted", liftedBy: actor.name, liftedAt: new Date(), note: note ?? suspension.note });
  await suspension.save();
  await releaseRegistration(suspension.registrationId);

  await recordAudit(actor, {
    action: "lift",
    entityType: "suspension",
    entityId: suspension._id,
    championshipId: suspension.championshipId,
    summary: "Suspensión levantada",
    changes: { note },
  });
  return suspension;
}

/** Lifts the active suspensions caused by the given (voided) events. */
export async function liftSuspensionsFromEvents(actor: Actor, eventIds: Types.ObjectId[]) {
  const active = await Suspension.find({ sourceEventId: { $in: eventIds }, status: "active" });
  for (const suspension of active) await liftSuspension(actor, suspension._id.toString(), "El evento que la originó fue anulado");
  return active.length;
}

/**
 * A match has just finished: every active suspension of the two teams (except those created in this
 * very match) counts one more served match and ends when the ban is complete.
 */
export async function serveSuspensions(actor: Actor, match: Pick<IMatch, "_id" | "championshipId" | "homeTeamId" | "awayTeamId">) {
  const active = await Suspension.find({
    championshipId: match.championshipId,
    teamId: { $in: [match.homeTeamId, match.awayTeamId] },
    status: "active",
    sourceMatchId: { $ne: match._id },
  });

  const completed: ISuspension[] = [];
  for (const suspension of active) {
    suspension.matchesServed += 1;
    if (suspension.matchesServed >= suspension.matchesToServe) {
      suspension.status = "served";
      completed.push(suspension);
    }
    await suspension.save();
    if (suspension.status === "served") await releaseRegistration(suspension.registrationId);
  }
  if (completed.length > 0) {
    await recordAudit(actor, {
      action: "update",
      entityType: "suspension",
      entityId: match._id,
      championshipId: match.championshipId,
      summary: `${completed.length} suspensión(es) cumplida(s) al cerrar el partido`,
      changes: { suspensionIds: completed.map((suspension) => suspension._id.toString()) },
    });
  }
  return completed.length;
}

/** A manual ban decided by the organizers (e.g. disciplinary committee). */
export async function createManualSuspension(actor: Actor, registrationId: string, matches: number, note: string) {
  const registration = await TeamRegistration.findById(registrationId).lean();
  if (!registration) throw notFound("Inscripción no encontrada");
  return createSuspension(actor, {
    championshipId: registration.championshipId,
    teamId: registration.teamId,
    playerId: registration.playerId,
    reason: "manual",
    matchesToServe: matches,
    note,
  });
}

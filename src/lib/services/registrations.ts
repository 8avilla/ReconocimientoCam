import { invalidateGalleries } from "@/lib/services/faceGallery";
import { Types } from "mongoose";
import type { Actor } from "@/lib/actor";
import { conflict, notFound } from "@/lib/api";
import { requireOrganizerOfChampionship } from "@/lib/permissions";
import { diffChanges, recordAudit } from "@/lib/audit";
import { Championship } from "@/models/Championship";
import { MatchCallUp } from "@/models/MatchCallUp";
import { Player } from "@/models/Player";
import { Team } from "@/models/Team";
import {
  ITeamRegistration,
  LIVE_REGISTRATION_STATUSES,
  Position,
  RegistrationStatus,
  TeamRegistration,
} from "@/models/TeamRegistration";

const isLive = (status: RegistrationStatus) => LIVE_REGISTRATION_STATUSES.includes(status);

export interface CreateRegistrationInput {
  teamId: string;
  playerId: string;
  shirtNumber: number;
  position?: Position;
  status?: RegistrationStatus;
}

async function assertRosterHasRoom(teamId: Types.ObjectId, championshipId: Types.ObjectId, excludeId?: Types.ObjectId) {
  const championship = await Championship.findById(championshipId).lean();
  if (!championship) throw notFound("Campeonato no encontrado");
  const liveCount = await TeamRegistration.countDocuments({
    teamId,
    status: { $in: LIVE_REGISTRATION_STATUSES },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (liveCount >= championship.rules.maxRosterSize) {
    throw conflict(
      `La plantilla del equipo alcanzó el máximo de ${championship.rules.maxRosterSize} jugadores`,
      "roster_full"
    );
  }
}

export async function createRegistration(actor: Actor, input: CreateRegistrationInput) {
  invalidateGalleries();
  const team = await Team.findById(input.teamId).lean();
  if (!team) throw notFound("Equipo no encontrado");
  await requireOrganizerOfChampionship(actor, team.championshipId);
  const player = await Player.findById(input.playerId).lean();
  if (!player) throw notFound("Jugador no encontrado");

  const status = input.status ?? "active";

  if (isLive(status)) {
    const existing = await TeamRegistration.findOne({
      championshipId: team.championshipId,
      playerId: player._id,
      status: { $in: LIVE_REGISTRATION_STATUSES },
    }).lean();
    if (existing) {
      throw conflict("El jugador ya pertenece a un equipo en este campeonato", "player_already_registered");
    }
    const numberTaken = await TeamRegistration.exists({
      teamId: team._id,
      shirtNumber: input.shirtNumber,
      status: { $in: LIVE_REGISTRATION_STATUSES },
    });
    if (numberTaken) {
      throw conflict(`El número ${input.shirtNumber} ya está en uso en este equipo`, "shirt_number_taken");
    }
    await assertRosterHasRoom(team._id, team.championshipId);
  }

  const registration = await TeamRegistration.create({
    championshipId: team.championshipId,
    teamId: team._id,
    playerId: player._id,
    shirtNumber: input.shirtNumber,
    position: input.position ?? "Delantero",
    status,
  });

  await recordAudit(actor, {
    action: "create",
    entityType: "registration",
    entityId: registration._id,
    championshipId: team.championshipId,
    summary: `Inscripción de ${player.fullName} en ${team.name} (#${input.shirtNumber})`,
  });
  return registration;
}

export interface UpdateRegistrationInput {
  shirtNumber?: number;
  position?: Position;
  status?: RegistrationStatus;
}

export async function updateRegistration(actor: Actor, id: string, input: UpdateRegistrationInput) {
  invalidateGalleries();
  const registration = await TeamRegistration.findById(id);
  if (!registration) throw notFound("Inscripción no encontrada");
  await requireOrganizerOfChampionship(actor, registration.championshipId);

  const before = registration.toObject() as ITeamRegistration;
  const nextStatus = input.status ?? registration.status;
  const nextNumber = input.shirtNumber ?? registration.shirtNumber;

  if (isLive(nextStatus)) {
    if (input.shirtNumber !== undefined || !isLive(registration.status)) {
      const numberTaken = await TeamRegistration.exists({
        _id: { $ne: registration._id },
        teamId: registration.teamId,
        shirtNumber: nextNumber,
        status: { $in: LIVE_REGISTRATION_STATUSES },
      });
      if (numberTaken) throw conflict(`El número ${nextNumber} ya está en uso en este equipo`, "shirt_number_taken");
    }
    if (!isLive(registration.status)) {
      // Reactivation: the player must not hold another live registration and the roster needs room.
      const other = await TeamRegistration.exists({
        _id: { $ne: registration._id },
        championshipId: registration.championshipId,
        playerId: registration.playerId,
        status: { $in: LIVE_REGISTRATION_STATUSES },
      });
      if (other) throw conflict("El jugador ya pertenece a un equipo en este campeonato", "player_already_registered");
      await assertRosterHasRoom(registration.teamId, registration.championshipId, registration._id);
    }
  }

  registration.set(input);
  await registration.save();

  const changes = diffChanges(before, input, ["shirtNumber", "position", "status"]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action: "update",
      entityType: "registration",
      entityId: registration._id,
      championshipId: registration.championshipId,
      summary: "Inscripción actualizada",
      changes,
    });
  }
  return registration;
}

export async function deleteRegistration(actor: Actor, id: string) {
  invalidateGalleries();
  const registration = await TeamRegistration.findById(id);
  if (!registration) throw notFound("Inscripción no encontrada");
  await requireOrganizerOfChampionship(actor, registration.championshipId);

  const usedInCallUp = await MatchCallUp.exists({ registrationId: registration._id });
  if (usedInCallUp) {
    throw conflict(
      "La inscripción tiene convocatorias asociadas; márcala como inactiva en lugar de eliminarla",
      "registration_in_use"
    );
  }
  await registration.deleteOne();
  await recordAudit(actor, {
    action: "delete",
    entityType: "registration",
    entityId: registration._id,
    championshipId: registration.championshipId,
    summary: "Inscripción eliminada",
    changes: { playerId: registration.playerId.toString(), teamId: registration.teamId.toString() },
  });
}

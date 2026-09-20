import { z } from "zod";
import {
  CHAMPIONSHIP_FORMATS,
  CHAMPIONSHIP_STATUSES,
} from "@/models/Championship";
import { POSITIONS, REGISTRATION_STATUSES } from "@/models/TeamRegistration";
import { MATCH_EVENT_TYPES, MATCH_STATUSES, SUSPENSION_STATUSES } from "@/lib/constants";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/models/AuditLog";
import {
  hexColorSchema,
  imageDataUrlSchema,
  objectIdSchema,
  optionalText,
  paginationSchema,
  requiredText,
} from "./common";

// ---------- Championships ----------

const rulesSchema = z
  .object({
    pointsPerWin: z.number().int().min(0),
    pointsPerDraw: z.number().int().min(0),
    pointsPerLoss: z.number().int().min(0),
    maxRosterSize: z.number().int().min(1).max(100),
    minPlayersToStart: z.number().int().min(1).max(30),
    yellowCardsForSuspension: z.number().int().min(1).max(20),
    yellowSuspensionMatches: z.number().int().min(1).max(20),
    redCardSuspensionMatches: z.number().int().min(1).max(20),
    verifyThreshold: z.number().min(0).max(1),
    reviewThreshold: z.number().min(0).max(1),
    allowManualReview: z.boolean(),
  })
  .partial()
  .refine(
    (rules) =>
      rules.verifyThreshold === undefined ||
      rules.reviewThreshold === undefined ||
      rules.reviewThreshold <= rules.verifyThreshold,
    { message: "El umbral de revisión no puede superar el umbral de verificación", path: ["reviewThreshold"] }
  );

export const championshipCreateSchema = z
  .object({
    name: requiredText(),
    season: requiredText(20),
    status: z.enum(CHAMPIONSHIP_STATUSES).optional(),
    format: z.enum(CHAMPIONSHIP_FORMATS).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    rules: rulesSchema.optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["endDate"],
  });

export const championshipUpdateSchema = z
  .object({
    name: requiredText(),
    season: requiredText(20),
    status: z.enum(CHAMPIONSHIP_STATUSES),
    format: z.enum(CHAMPIONSHIP_FORMATS),
    startDate: z.coerce.date().nullable(),
    endDate: z.coerce.date().nullable(),
    rules: rulesSchema,
  })
  .partial();

export const championshipListQuery = paginationSchema.extend({
  status: z.enum(CHAMPIONSHIP_STATUSES).optional(),
  q: z.string().trim().max(60).optional(),
});

// ---------- Teams ----------

export const teamCreateSchema = z.object({
  championshipId: objectIdSchema,
  name: requiredText(),
  delegateName: optionalText().optional(),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
});

export const teamUpdateSchema = z
  .object({
    name: requiredText(),
    delegateName: optionalText(),
    primaryColor: hexColorSchema,
    secondaryColor: hexColorSchema,
    active: z.boolean(),
  })
  .partial();

export const teamListQuery = paginationSchema.extend({
  championshipId: objectIdSchema.optional(),
  q: z.string().trim().max(60).optional(),
  active: z.enum(["true", "false"]).optional(),
});

export const imageUploadSchema = z.object({ image: imageDataUrlSchema });

// ---------- Players ----------

const birthDateSchema = z.coerce
  .date()
  .refine((date) => date <= new Date(), { message: "La fecha de nacimiento no puede ser futura" })
  .refine((date) => date.getUTCFullYear() >= 1930, { message: "La fecha de nacimiento no es válida" });

export const playerCreateSchema = z.object({
  fullName: requiredText(),
  documentId: requiredText(30),
  birthDate: birthDateSchema,
});

export const playerUpdateSchema = z
  .object({
    fullName: requiredText(),
    documentId: requiredText(30),
    birthDate: birthDateSchema,
  })
  .partial();

export const playerListQuery = paginationSchema.extend({
  q: z.string().trim().max(60).optional(),
  championshipId: objectIdSchema.optional(),
  teamId: objectIdSchema.optional(),
});

export const faceEnrollSchema = z.object({
  image: imageDataUrlSchema,
  /** Explicit biometric consent; required the first time a face is enrolled. */
  consent: z.boolean().optional(),
});

export const playerCardQuery = z.object({ championshipId: objectIdSchema.optional() });

// ---------- Registrations ----------

export const registrationCreateSchema = z.object({
  teamId: objectIdSchema,
  playerId: objectIdSchema,
  shirtNumber: z.number().int().min(0).max(999),
  position: z.enum(POSITIONS).optional(),
  status: z.enum(REGISTRATION_STATUSES).optional(),
});

export const registrationUpdateSchema = z
  .object({
    shirtNumber: z.number().int().min(0).max(999),
    position: z.enum(POSITIONS),
    status: z.enum(REGISTRATION_STATUSES),
  })
  .partial();

export const registrationListQuery = paginationSchema.extend({
  championshipId: objectIdSchema.optional(),
  teamId: objectIdSchema.optional(),
  playerId: objectIdSchema.optional(),
  status: z.enum(REGISTRATION_STATUSES).optional(),
});

// ---------- Matches ----------

export const matchCreateSchema = z
  .object({
    championshipId: objectIdSchema,
    homeTeamId: objectIdSchema,
    awayTeamId: objectIdSchema,
    scheduledAt: z.coerce.date(),
    venue: optionalText().optional(),
    round: optionalText(40).optional(),
  })
  .refine((value) => value.homeTeamId !== value.awayTeamId, {
    message: "El equipo local y el visitante deben ser distintos",
    path: ["awayTeamId"],
  });

export const matchUpdateSchema = z
  .object({
    scheduledAt: z.coerce.date(),
    venue: optionalText(),
    round: optionalText(40),
    // live/finished are reached through the match transitions; scores are derived from events.
    status: z.enum(["scheduled", "postponed", "suspended", "walkover"]),
  })
  .partial();

export const matchListQuery = paginationSchema.extend({
  championshipId: objectIdSchema.optional(),
  teamId: objectIdSchema.optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ---------- Check-ins ----------


/**
 * Attendance is registered either from a successful verification (method is derived from it)
 * or as a QR/manual contingency (the reason of a manual one is optional). Face check-ins can only
 * come from a verification.
 */
export const checkInCreateSchema = z
  .object({
    playerId: objectIdSchema,
    status: z.enum(["present", "absent"]),
    method: z.enum(["qr", "manual"]).optional(),
    reason: optionalText(300).optional(),
    verificationId: objectIdSchema.optional(),
  })
  .refine((value) => value.verificationId || value.method, {
    message: "Indica el método de registro",
    path: ["method"],
  })
  .refine((value) => !value.verificationId || value.status === "present", {
    message: "Una verificación solo puede confirmar presencia",
    path: ["status"],
  });

export const lookupQuery = z.object({ code: z.string().trim().min(1, "Ingresa un código").max(60) });

export const verificationCreateSchema = z.object({ playerId: objectIdSchema, image: imageDataUrlSchema });

export const manualReviewSchema = z.object({
  playerId: objectIdSchema,
  reason: z.string().trim().min(3, "Describe el motivo de la revisión manual").max(300),
});

// ---------- Match management ----------

export const matchEventCreateSchema = z
  .object({
    type: z.enum(MATCH_EVENT_TYPES),
    teamId: objectIdSchema,
    playerId: objectIdSchema.optional(),
    /** Assist on a goal, or the player entering on a substitution. */
    relatedPlayerId: objectIdSchema.optional(),
    minute: z.number().int().min(0, "El minuto no es válido").max(150, "El minuto no es válido"),
    note: optionalText(300).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "incident") {
      if (!value.note) context.addIssue({ code: "custom", path: ["note"], message: "Describe el incidente" });
      return;
    }
    if (!value.playerId) context.addIssue({ code: "custom", path: ["playerId"], message: "Selecciona al jugador" });
    if (value.type === "substitution" && !value.relatedPlayerId) {
      context.addIssue({ code: "custom", path: ["relatedPlayerId"], message: "Selecciona al jugador que entra" });
    }
    if (value.relatedPlayerId && value.relatedPlayerId === value.playerId) {
      context.addIssue({ code: "custom", path: ["relatedPlayerId"], message: "Debe ser un jugador distinto" });
    }
  });

export const matchTransitionSchema = z.object({
  action: z.enum(["start", "halftime", "resume", "finish"]),
  /** Start even though a team lacks the minimum of present players; requires a reason. */
  force: z.boolean().optional(),
  reason: optionalText(300).optional(),
});

export const suspensionCreateSchema = z.object({
  registrationId: objectIdSchema,
  matches: z.number().int().min(1).max(20),
  note: z.string().trim().min(3, "Describe el motivo de la suspensión").max(300),
});

export const suspensionLiftSchema = z.object({ note: optionalText(300).optional() });

export const suspensionListQuery = paginationSchema.extend({
  championshipId: objectIdSchema.optional(),
  teamId: objectIdSchema.optional(),
  playerId: objectIdSchema.optional(),
  matchId: objectIdSchema.optional(),
  status: z.enum(SUSPENSION_STATUSES).optional(),
});

// ---------- Audit ----------

export const auditListQuery = paginationSchema.extend({
  championshipId: objectIdSchema.optional(),
  entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
  entityId: objectIdSchema.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
});

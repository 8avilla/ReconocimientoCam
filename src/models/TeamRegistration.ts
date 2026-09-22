import { Schema, model, models, Model, Types } from "mongoose";

import { POSITIONS, REGISTRATION_STATUSES, type Position, type RegistrationStatus } from "@/lib/constants";

export { POSITIONS, REGISTRATION_STATUSES };
export type { Position, RegistrationStatus };

/** Statuses in which a registration still occupies a spot in the roster. */
export const LIVE_REGISTRATION_STATUSES: RegistrationStatus[] = ["pending", "active", "suspended"];

/** Participation of a player in a team within a championship. */
export interface ITeamRegistration {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  teamId: Types.ObjectId;
  playerId: Types.ObjectId;
  /** Optional: not every player has one assigned yet. */
  shirtNumber?: number;
  /** Optional: same reason as `shirtNumber`. */
  position?: Position;
  status: RegistrationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TeamRegistrationSchema = new Schema<ITeamRegistration>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    shirtNumber: { type: Number, min: 0, max: 999 },
    position: { type: String, enum: POSITIONS },
    status: { type: String, enum: REGISTRATION_STATUSES, default: "active" },
  },
  { timestamps: true }
);

// A player can only belong to one team per championship (unless formally transferred = inactivated).
TeamRegistrationSchema.index(
  { championshipId: 1, playerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: LIVE_REGISTRATION_STATUSES } } }
);
// A shirt number is unique inside a team while the registration is live; registrations without
// one yet (shirtNumber not set) are excluded so several of them don't collide with each other.
TeamRegistrationSchema.index(
  { teamId: 1, shirtNumber: 1 },
  { unique: true, partialFilterExpression: { status: { $in: LIVE_REGISTRATION_STATUSES }, shirtNumber: { $exists: true } } }
);
TeamRegistrationSchema.index({ teamId: 1, status: 1 });

export const TeamRegistration: Model<ITeamRegistration> =
  (models.TeamRegistration as Model<ITeamRegistration>) ||
  model<ITeamRegistration>("TeamRegistration", TeamRegistrationSchema);

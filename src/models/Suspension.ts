import { Schema, model, models, Model, Types } from "mongoose";
import {
  SUSPENSION_REASONS,
  SUSPENSION_STATUSES,
  type SuspensionReason,
  type SuspensionStatus,
} from "@/lib/constants";

export { SUSPENSION_REASONS, SUSPENSION_STATUSES };
export type { SuspensionReason, SuspensionStatus };

/** A player ban. While active, the player's registration is suspended and cannot be called up. */
export interface ISuspension {
  _id: Types.ObjectId;
  championshipId: Types.ObjectId;
  teamId: Types.ObjectId;
  playerId: Types.ObjectId;
  registrationId: Types.ObjectId;
  reason: SuspensionReason;
  matchesToServe: number;
  /** Finished matches of the team since the suspension began. */
  matchesServed: number;
  status: SuspensionStatus;
  /** Match and event that caused it (absent for manual suspensions). */
  sourceMatchId?: Types.ObjectId;
  sourceEventId?: Types.ObjectId;
  note?: string;
  createdBy: string;
  liftedBy?: string;
  liftedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SuspensionSchema = new Schema<ISuspension>(
  {
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    registrationId: { type: Schema.Types.ObjectId, ref: "TeamRegistration", required: true },
    reason: { type: String, enum: SUSPENSION_REASONS, required: true },
    matchesToServe: { type: Number, required: true, min: 1 },
    matchesServed: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: SUSPENSION_STATUSES, default: "active" },
    sourceMatchId: { type: Schema.Types.ObjectId, ref: "Match" },
    sourceEventId: { type: Schema.Types.ObjectId, ref: "MatchEvent" },
    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: String, required: true },
    liftedBy: { type: String },
    liftedAt: { type: Date },
  },
  { timestamps: true }
);

SuspensionSchema.index({ championshipId: 1, status: 1, createdAt: -1 });
SuspensionSchema.index({ playerId: 1, status: 1 });
SuspensionSchema.index({ teamId: 1, status: 1 });

export const Suspension: Model<ISuspension> =
  (models.Suspension as Model<ISuspension>) || model<ISuspension>("Suspension", SuspensionSchema);

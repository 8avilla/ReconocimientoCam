import { Schema, model, models, Model, Types } from "mongoose";

export const CHECK_IN_STATUSES = ["pending", "present", "absent"] as const;
export const CHECK_IN_METHODS = ["qr", "face", "manual"] as const;

export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number];
export type CheckInMethod = (typeof CHECK_IN_METHODS)[number];

/** Presence of a called-up player at a match. Always belongs to a match. */
export interface IPlayerCheckIn {
  _id: Types.ObjectId;
  matchId: Types.ObjectId;
  teamId: Types.ObjectId;
  playerId: Types.ObjectId;
  callUpId: Types.ObjectId;
  status: CheckInStatus;
  method?: CheckInMethod;
  checkedInAt?: Date;
  operatorName?: string;
  operatorUserId?: string | null;
  /** Mandatory when the method is manual (contingency). */
  manualReason?: string;
  /** Latest identity verification linked to this check-in, when there is one. */
  verificationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerCheckInSchema = new Schema<IPlayerCheckIn>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    callUpId: { type: Schema.Types.ObjectId, ref: "MatchCallUp", required: true },
    status: { type: String, enum: CHECK_IN_STATUSES, default: "pending" },
    method: { type: String, enum: CHECK_IN_METHODS },
    checkedInAt: { type: Date },
    operatorName: { type: String },
    operatorUserId: { type: String, default: null },
    manualReason: { type: String, trim: true },
    verificationId: { type: Schema.Types.ObjectId, ref: "IdentityVerification" },
  },
  { timestamps: true }
);

PlayerCheckInSchema.index({ matchId: 1, playerId: 1 }, { unique: true });
PlayerCheckInSchema.index({ matchId: 1, status: 1 });

export const PlayerCheckIn: Model<IPlayerCheckIn> =
  (models.PlayerCheckIn as Model<IPlayerCheckIn>) || model<IPlayerCheckIn>("PlayerCheckIn", PlayerCheckInSchema);

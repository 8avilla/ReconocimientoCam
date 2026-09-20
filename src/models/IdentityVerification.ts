import { Schema, model, models, Model, Types } from "mongoose";

export const VERIFICATION_RESULTS = ["verified", "review", "mismatch"] as const;
export const VERIFICATION_METHODS = ["face", "manual_review"] as const;

export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

/** Outcome of an identity check for a player at a match. Belongs to player + match. */
export interface IIdentityVerification {
  _id: Types.ObjectId;
  matchId: Types.ObjectId;
  playerId: Types.ObjectId;
  checkInId?: Types.ObjectId;
  result: VerificationResult;
  /** Cosine similarity score of the automatic comparison; absent for manual reviews. */
  confidence?: number;
  method: VerificationMethod;
  performedAt: Date;
  operatorName: string;
  operatorUserId?: string | null;
  /** Evidence image, stored only when the privacy policy allows it. */
  evidenceUrl?: string;
  evidenceBlobName?: string;
  /** Mandatory when a person overrides the automatic result. */
  manualReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IdentityVerificationSchema = new Schema<IIdentityVerification>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    checkInId: { type: Schema.Types.ObjectId, ref: "PlayerCheckIn" },
    result: { type: String, enum: VERIFICATION_RESULTS, required: true },
    confidence: { type: Number, min: -1, max: 1 },
    method: { type: String, enum: VERIFICATION_METHODS, required: true },
    performedAt: { type: Date, required: true, default: () => new Date() },
    operatorName: { type: String, required: true },
    operatorUserId: { type: String, default: null },
    evidenceUrl: { type: String },
    evidenceBlobName: { type: String },
    manualReason: { type: String, trim: true },
  },
  { timestamps: true }
);

IdentityVerificationSchema.index({ matchId: 1, playerId: 1, performedAt: -1 });

export const IdentityVerification: Model<IIdentityVerification> =
  (models.IdentityVerification as Model<IIdentityVerification>) ||
  model<IIdentityVerification>("IdentityVerification", IdentityVerificationSchema);

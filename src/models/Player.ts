import { Schema, model, models, Model, Types } from "mongoose";

/**
 * Player identity. It is independent from any team or championship: participation lives in
 * TeamRegistration so the same person keeps one identity across championships.
 */
export interface IPlayer {
  _id: Types.ObjectId;
  /** Opaque identifier encoded in the QR code; it carries no personal data. */
  publicId: string;
  fullName: string;
  /** Optional: not every player has it on hand at registration time. */
  documentId?: string;
  /** Optional: same reason as `documentId`. */
  birthDate?: Date;
  /** ID card / avatar photo, shown everywhere in the app: a looser crop, more natural to look at. */
  photoUrl: string;
  photoBlobName: string;
  /**
   * Tight, aligned crop of the same enrollment shot: what the embedding was computed from, and what's
   * shown next to a live capture during manual review. Empty for players enrolled before this existed
   * (they fall back to `photoUrl`, their only photo at the time).
   */
  facePhotoUrl?: string;
  facePhotoBlobName?: string;
  /** L2-normalized face embedding; never returned by default. */
  faceEmbedding?: number[];
  /** Pipeline version that produced faceEmbedding; missing means the legacy pipeline (1). */
  embeddingVersion?: number;
  biometricConsentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayer>(
  {
    publicId: { type: String, required: true, unique: true, immutable: true },
    fullName: { type: String, required: true, trim: true },
    // Sparse: many players are missing this at first; the unique index must only apply when it's set.
    documentId: { type: String, unique: true, sparse: true, trim: true },
    birthDate: { type: Date },
    photoUrl: { type: String, default: "" },
    photoBlobName: { type: String, default: "" },
    facePhotoUrl: { type: String, default: "" },
    facePhotoBlobName: { type: String, default: "" },
    faceEmbedding: { type: [Number], default: undefined, select: false },
    embeddingVersion: { type: Number },
    biometricConsentAt: { type: Date },
  },
  { timestamps: true }
);

PlayerSchema.index({ fullName: 1 });

export const Player: Model<IPlayer> = (models.Player as Model<IPlayer>) || model<IPlayer>("Player", PlayerSchema);

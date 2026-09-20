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
  documentId: string;
  birthDate: Date;
  photoUrl: string;
  photoBlobName: string;
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
    documentId: { type: String, required: true, unique: true, trim: true },
    birthDate: { type: Date, required: true },
    photoUrl: { type: String, default: "" },
    photoBlobName: { type: String, default: "" },
    faceEmbedding: { type: [Number], default: undefined, select: false },
    embeddingVersion: { type: Number },
    biometricConsentAt: { type: Date },
  },
  { timestamps: true }
);

PlayerSchema.index({ fullName: 1 });

export const Player: Model<IPlayer> = (models.Player as Model<IPlayer>) || model<IPlayer>("Player", PlayerSchema);

import { Schema, model, models, Model, Types } from "mongoose";

/**
 * Singleton document (exactly one, created lazily on first read/write — see `getSystemSettings`) for
 * app-wide configuration that applies to every championship alike, not a per-championship rule.
 */
export interface ISystemSettings {
  _id: Types.ObjectId;
  /** Cosine similarity at or above which a face is verified automatically, across every championship. */
  verifyThreshold: number;
  /** Cosine similarity at or above which a face goes to manual review (below verifyThreshold). */
  reviewThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

// Face thresholds validated on LFW with the aligned pipeline (see docs/CALIBRACION_FACIAL.md);
// recalibrate with real match photos when available.
const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    verifyThreshold: { type: Number, default: 0.35, min: 0, max: 1 },
    reviewThreshold: { type: Number, default: 0.25, min: 0, max: 1 },
  },
  { timestamps: true }
);

export const SystemSettings: Model<ISystemSettings> =
  (models.SystemSettings as Model<ISystemSettings>) || model<ISystemSettings>("SystemSettings", SystemSettingsSchema);

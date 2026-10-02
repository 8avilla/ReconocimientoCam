import { Schema, model, models, Model, Types } from "mongoose";
import { invalidateOnWrite } from "@/lib/serverCache";

/** How long a screen view is kept: enough to see what gets used, short enough not to pile up. */
export const USAGE_RETENTION_DAYS = 180;

/** One screen view, by route pattern (`/c/:id/partidos`, never a real id) and the role of whoever opened it. */
export interface IUsageEvent {
  _id: Types.ObjectId;
  route: string;
  role: string;
  userId?: string | null;
  createdAt: Date;
}

const UsageEventSchema = new Schema<IUsageEvent>({
  route: { type: String, required: true, maxlength: 100 },
  role: { type: String, required: true },
  userId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, expires: USAGE_RETENTION_DAYS * 24 * 60 * 60 },
});
UsageEventSchema.index({ createdAt: -1, route: 1 });

invalidateOnWrite(UsageEventSchema, "UsageEvent");

export const UsageEvent: Model<IUsageEvent> = (models.UsageEvent as Model<IUsageEvent>) || model<IUsageEvent>("UsageEvent", UsageEventSchema);

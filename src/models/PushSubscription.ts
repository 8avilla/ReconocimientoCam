import { Schema, model, models, Model, Types } from "mongoose";
import { invalidateOnWrite } from "@/lib/serverCache";

/** A device that agreed to receive notifications (Web Push): where to send them and the keys to encrypt them. */
export interface IPushSubscription {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

invalidateOnWrite(PushSubscriptionSchema, "PushSubscription");

export const PushSubscription: Model<IPushSubscription> =
  (models.PushSubscription as Model<IPushSubscription>) || model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);

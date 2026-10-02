import { Schema, model, models, Model, Types } from "mongoose";
import { invalidateOnWrite } from "@/lib/serverCache";

/** Notifications are kept this long: enough to catch up after a trip, short enough not to pile up. */
export const NOTIFICATION_RETENTION_DAYS = 60;

export const NOTIFICATION_KINDS = ["match_scheduled", "match_started", "match_finished", "goal", "yellow_card", "red_card", "suspension"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** One item of a person's notification list (the bell), created when something happens to what they follow. */
export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Where tapping it leads, inside the app. */
  url: string;
  readAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 300 },
  url: { type: String, required: true, maxlength: 200 },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now, expires: NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 },
});
NotificationSchema.index({ userId: 1, createdAt: -1 });

invalidateOnWrite(NotificationSchema, "Notification");

export const Notification: Model<INotification> = (models.Notification as Model<INotification>) || model<INotification>("Notification", NotificationSchema);

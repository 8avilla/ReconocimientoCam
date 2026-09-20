import { Schema, model, models, Model, Types } from "mongoose";

export const AUDIT_ENTITY_TYPES = [
  "championship",
  "team",
  "player",
  "registration",
  "match",
  "call_up",
  "check_in",
  "verification",
  "match_event",
  "suspension",
] as const;

export const AUDIT_ACTIONS = ["create", "update", "delete", "call_up_change", "check_in", "face_enroll", "face_remove", "void", "transition", "lift"] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditLog {
  _id: Types.ObjectId;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  championshipId?: Types.ObjectId;
  actorName: string;
  actorUserId?: string | null;
  actorRole: string;
  /** Changed fields as { field: { from, to } } for updates, or a small snapshot for create/delete. */
  changes?: Record<string, unknown>;
  summary: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityType: { type: String, enum: AUDIT_ENTITY_TYPES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    championshipId: { type: Schema.Types.ObjectId, ref: "Championship" },
    actorName: { type: String, required: true },
    actorUserId: { type: String, default: null },
    actorRole: { type: String, required: true },
    changes: { type: Schema.Types.Mixed },
    summary: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ championshipId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

// Audit history is append-only: block every update and delete path.
const IMMUTABLE_MESSAGE = "AuditLog entries are immutable";
const blockedQueryOps = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const;
for (const op of blockedQueryOps) {
  AuditLogSchema.pre(op, function () {
    throw new Error(IMMUTABLE_MESSAGE);
  });
}
AuditLogSchema.pre("save", function () {
  if (!this.isNew) throw new Error(IMMUTABLE_MESSAGE);
});

export const AuditLog: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog>) || model<IAuditLog>("AuditLog", AuditLogSchema);

import { Schema, model, models, Model, Types } from "mongoose";
import { invalidateOnWrite } from "@/lib/serverCache";

import { FOLLOW_TARGET_TYPES, type FollowTargetType } from "@/lib/constants";

export { FOLLOW_TARGET_TYPES, type FollowTargetType };

/** A signed-in person follows a championship, a team or a player: what they get notifications about. */
export interface IFollow {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  targetType: FollowTargetType;
  targetId: Types.ObjectId;
  createdAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: FOLLOW_TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
FollowSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
// "Who follows this?" when something happens to a team, player or championship.
FollowSchema.index({ targetType: 1, targetId: 1 });

invalidateOnWrite(FollowSchema, "Follow");

export const Follow: Model<IFollow> = (models.Follow as Model<IFollow>) || model<IFollow>("Follow", FollowSchema);

import { Types } from "mongoose";
import { Follow, FOLLOW_TARGET_TYPES, type FollowTargetType } from "@/models/Follow";

export type FollowsDTO = Record<FollowTargetType, string[]>;

const empty = (): FollowsDTO => ({ championship: [], team: [], player: [] });

/** What a person follows, grouped by kind. */
export async function listFollows(userId: string): Promise<FollowsDTO> {
  const follows = await Follow.find({ userId }).select("targetType targetId").lean();
  const result = empty();
  for (const follow of follows) result[follow.targetType].push(follow.targetId.toString());
  return result;
}

export async function follow(userId: string, targetType: FollowTargetType, targetId: string) {
  await Follow.updateOne({ userId, targetType, targetId }, { $setOnInsert: { userId, targetType, targetId } }, { upsert: true });
}

export async function unfollow(userId: string, targetType: FollowTargetType, targetId: string) {
  await Follow.deleteOne({ userId, targetType, targetId });
}

const MAX_IMPORT = 300;

/** Adds what a person followed in this browser before signing in. Never removes anything. */
export async function importFollows(userId: string, local: Partial<Record<FollowTargetType, string[]>>) {
  const owner = new Types.ObjectId(userId);
  const operations = FOLLOW_TARGET_TYPES.flatMap((targetType) =>
    (local[targetType] ?? [])
      .filter((id) => Types.ObjectId.isValid(id))
      .slice(0, MAX_IMPORT)
      .map((id) => {
        const targetId = new Types.ObjectId(id);
        return { updateOne: { filter: { userId: owner, targetType, targetId }, update: { $setOnInsert: { userId: owner, targetType, targetId } }, upsert: true } };
      })
  );
  if (operations.length > 0) await Follow.bulkWrite(operations);
}

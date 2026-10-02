import { ApiError, json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { follow, listFollows, unfollow } from "@/lib/services/follows";
import { followSchema } from "@/lib/validation/schemas";

function userIdOf(request: Parameters<typeof getActor>[0]): string {
  const { userId } = getActor(request);
  if (!userId) throw new ApiError(401, "Inicia sesión para seguir", "unauthenticated");
  return userId;
}

/** Everything the signed-in person follows. */
export const GET = route(async (request) => json(await listFollows(userIdOf(request))));

export const POST = route(async (request) => {
  const userId = userIdOf(request);
  const { targetType, targetId } = await parseBody(request, followSchema);
  await follow(userId, targetType, targetId);
  return json({ ok: true }, 201);
});

export const DELETE = route(async (request) => {
  const userId = userIdOf(request);
  const { targetType, targetId } = await parseBody(request, followSchema);
  await unfollow(userId, targetType, targetId);
  return json({ ok: true });
});

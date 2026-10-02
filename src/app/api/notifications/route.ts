import { ApiError, json, parseQuery, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { Notification } from "@/models/Notification";
import { notificationListQuery } from "@/lib/validation/schemas";

/** The bell: the person's latest notifications and how many are unread. Always empty when signed out. */
export const GET = route(async (request) => {
  const { userId } = getActor(request);
  if (!userId) throw new ApiError(401, "Inicia sesión para ver tus avisos", "unauthenticated");
  const { limit } = parseQuery(request, notificationListQuery);
  const [data, unread] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).select("kind title body url readAt createdAt").lean(),
    Notification.countDocuments({ userId, readAt: { $exists: false } }),
  ]);
  return json({ data, unread });
});

import { ApiError, json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { Notification } from "@/models/Notification";
import { notificationReadSchema } from "@/lib/validation/schemas";

/** Marks some notifications (or all, with no ids) as read. */
export const POST = route(async (request) => {
  const { userId } = getActor(request);
  if (!userId) throw new ApiError(401, "Inicia sesión para ver tus avisos", "unauthenticated");
  const { ids } = await parseBody(request, notificationReadSchema);
  await Notification.updateMany({ userId, readAt: { $exists: false }, ...(ids ? { _id: { $in: ids } } : {}) }, { $set: { readAt: new Date() } });
  return json({ ok: true });
});

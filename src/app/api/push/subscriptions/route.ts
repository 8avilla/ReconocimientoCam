import { ApiError, json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { pushConfigured } from "@/lib/services/notifications";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "@/lib/validation/schemas";
import { PushSubscription } from "@/models/PushSubscription";

function userIdOf(request: Parameters<typeof getActor>[0]): string {
  const { userId } = getActor(request);
  if (!userId) throw new ApiError(401, "Inicia sesión para recibir avisos", "unauthenticated");
  return userId;
}

/** Whether this server can send pop-ups at all (it needs the VAPID keys). */
export const GET = route(async () => json({ enabled: pushConfigured() }));

/** Registers this device for pop-ups. The same device signing in as someone else moves to that person. */
export const POST = route(async (request) => {
  const userId = userIdOf(request);
  if (!pushConfigured()) throw new ApiError(503, "Los avisos en el teléfono no están disponibles por ahora", "push_disabled");
  const { endpoint, keys } = await parseBody(request, pushSubscribeSchema);
  await PushSubscription.updateOne(
    { endpoint },
    { $set: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: request.headers.get("user-agent")?.slice(0, 300) } },
    { upsert: true }
  );
  return json({ ok: true }, 201);
});

export const DELETE = route(async (request) => {
  const userId = userIdOf(request);
  const { endpoint } = await parseBody(request, pushUnsubscribeSchema);
  await PushSubscription.deleteOne({ userId, endpoint });
  return json({ ok: true });
});

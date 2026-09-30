import { NextRequest } from "next/server";
import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { usageViewSchema } from "@/lib/validation/schemas";
import { UsageEvent } from "@/models/UsageEvent";

// Per-visitor cap so the endpoint can't be used to flood the collection. In memory, like the sign-in limiter.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, number[]>();

function tooMany(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  hits.set(key, [...recent, now]);
  if (hits.size > 5000) for (const [entry, times] of hits) if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(entry);
  return false;
}

const clientKey = (request: NextRequest, userId: string | null) => userId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";

/** Records that the caller opened a screen. Open to everyone (visitors too); it stores the route pattern and role, nothing else. */
export const POST = route(async (request) => {
  const actor = getActor(request);
  const { route: screen } = await parseBody(request, usageViewSchema);
  if (!tooMany(clientKey(request, actor.userId))) {
    await UsageEvent.create({ route: screen, role: actor.role, userId: actor.userId });
  }
  return json({ ok: true }, 202);
});

import { json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireAdmin } from "@/lib/permissions";
import { getSystemSettings, updateSystemSettings } from "@/lib/services/systemSettings";
import { systemSettingsUpdateSchema } from "@/lib/validation/schemas";

/** App-wide configuration (currently just the face-verification thresholds), the same for every championship. */
export const GET = route(async (request) => {
  requireAdmin(getActor(request));
  return json(await getSystemSettings());
});

export const PATCH = route(async (request) => {
  const input = await parseBody(request, systemSettingsUpdateSchema);
  return json(await updateSystemSettings(getActor(request), input));
});

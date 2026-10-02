import { ApiError, json, parseBody, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { importFollows, listFollows } from "@/lib/services/follows";
import { followImportSchema } from "@/lib/validation/schemas";

/** Brings what was followed in this browser (before signing in) into the account. Returns the merged result. */
export const POST = route(async (request) => {
  const { userId } = getActor(request);
  if (!userId) throw new ApiError(401, "Inicia sesión para seguir", "unauthenticated");
  await importFollows(userId, await parseBody(request, followImportSchema));
  return json(await listFollows(userId));
});

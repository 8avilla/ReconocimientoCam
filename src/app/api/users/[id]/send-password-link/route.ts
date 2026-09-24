import { json, notFound, route } from "@/lib/api";
import { getActor } from "@/lib/actor";
import { requireAdmin } from "@/lib/permissions";
import { requestPasswordReset } from "@/lib/services/auth";
import { User } from "@/models/User";

type Params = { id: string };

/** Admin action: (re)sends the same "set your password" link a self-service "forgot password" would send. */
export const POST = route<Params>(async (request, { id }) => {
  requireAdmin(getActor(request));
  const user = await User.findById(id).select("email").lean();
  if (!user) throw notFound("Usuario no encontrado");
  await requestPasswordReset(user.email);
  return json({ ok: true });
});

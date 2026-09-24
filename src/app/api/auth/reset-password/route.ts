import { json, parseBody, route } from "@/lib/api";
import { resetPassword } from "@/lib/services/auth";
import { resetPasswordSchema } from "@/lib/validation/schemas";

export const POST = route(async (request) => {
  const { token, password } = await parseBody(request, resetPasswordSchema);
  await resetPassword(token, password);
  return json({ ok: true });
});

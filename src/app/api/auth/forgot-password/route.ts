import { json, parseBody, route } from "@/lib/api";
import { requestPasswordReset } from "@/lib/services/auth";
import { forgotPasswordSchema } from "@/lib/validation/schemas";

/** Always answers success, whether or not that email has an account, so it can't be used to check who's registered. */
export const POST = route(async (request) => {
  const { email } = await parseBody(request, forgotPasswordSchema);
  await requestPasswordReset(email);
  return json({ ok: true });
});

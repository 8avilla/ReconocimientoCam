import { json, parseBody, route } from "@/lib/api";
import { registerUser } from "@/lib/services/auth";
import { registerSchema } from "@/lib/validation/schemas";

/** Public self-registration. The client signs the new account in right after via next-auth/react. */
export const POST = route(async (request) => {
  const input = await parseBody(request, registerSchema);
  const user = await registerUser(input);
  return json({ id: user._id.toString(), email: user.email, name: user.name }, 201);
});

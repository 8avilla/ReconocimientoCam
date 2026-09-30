import { ApiError, json, parseBody, route } from "@/lib/api";
import { registerUser } from "@/lib/services/auth";
import { registerSchema } from "@/lib/validation/schemas";

/** Self-registration (off unless ALLOW_SELF_REGISTER=1). The client signs the new account in right after via next-auth/react. */
export const POST = route(async (request) => {
  // Closed by default: accounts with a password are handed out by an admin. Set ALLOW_SELF_REGISTER=1 to open it.
  if (process.env.ALLOW_SELF_REGISTER !== "1") throw new ApiError(403, "El registro está cerrado", "registration_closed");
  const input = await parseBody(request, registerSchema);
  const user = await registerUser(input);
  return json({ id: user._id.toString(), email: user.email, name: user.name }, 201);
});

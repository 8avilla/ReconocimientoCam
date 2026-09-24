import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { badRequest, conflict } from "@/lib/api";
import { sendMail } from "@/lib/mail";
import { User } from "@/models/User";
import { getDefaultRoleIdForNewUser } from "./roles";
import { resolveOrganizerInvites } from "./users";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_MIN_LENGTH = 8;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Public self-registration: creates the account and resolves any pending organizer invite for this email. */
export async function registerUser({ name, email, password }: { name: string; email: string; password: string }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    throw conflict("Ya existe una cuenta con ese correo", "duplicate");
  }
  const [passwordHash, roleId] = await Promise.all([bcrypt.hash(password, 10), getDefaultRoleIdForNewUser()]);
  const user = await User.create({ email: normalizedEmail, name: name.trim(), passwordHash, roleId });
  await resolveOrganizerInvites(user._id, normalizedEmail);
  return user;
}

/**
 * Always succeeds from the caller's point of view (never reveals whether the email has an account) —
 * only actually sends an email when it does. Also used by the admin's "send password link" action for a
 * user that was created without a password, since it's the exact same "prove you own this inbox" flow.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("_id name").lean();
  if (!user) return;

  const token = crypto.randomBytes(32).toString("hex");
  await User.updateOne(
    { _id: user._id },
    { resetPasswordTokenHash: hashToken(token), resetPasswordExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) }
  );

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3096";
  const link = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
  await sendMail({
    to: normalizedEmail,
    subject: "Recupera tu contraseña en Super Torneos",
    html: `<p>Hola ${user.name},</p><p>Haz clic en el siguiente enlace para elegir una nueva contraseña. El enlace vence en una hora.</p><p><a href="${link}">${link}</a></p><p>Si no pediste esto, ignora este correo.</p>`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (newPassword.length < PASSWORD_MIN_LENGTH) throw badRequest(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  const user = await User.findOne({
    resetPasswordTokenHash: hashToken(token),
    resetPasswordExpiresAt: { $gt: new Date() },
  });
  if (!user) throw badRequest("El enlace no es válido o ya venció; solicita uno nuevo", "invalid_token");

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();
}

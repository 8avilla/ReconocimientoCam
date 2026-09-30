/**
 * Creates (or resets the password of) a verified email/password account.
 * Usage: npm run demo:user -- correo@ejemplo.com "Nombre" [--password=...] [--manage="Torneo"] [--demo[=días]]
 *   --manage  makes the account an organizer of that existing championship.
 *   --demo    also gives the account its own copy of the demo template (default 14 days).
 * A random password is generated when --password is omitted.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { createDemoForUser } from "@/lib/services/demo";
import { getDefaultRoleIdForNewUser } from "@/lib/services/roles";
import { Championship } from "@/models/Championship";
import { User } from "@/models/User";

const option = (name: string) => process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const flag = (name: string) => process.argv.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));

async function main() {
  const [rawEmail, name] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (!rawEmail || !name) throw new Error('Uso: npm run demo:user -- correo@ejemplo.com "Nombre" [--password=...] [--manage="Torneo"] [--demo[=días]]');
  const email = rawEmail.trim().toLowerCase();
  const password = option("password") ?? crypto.randomBytes(6).toString("base64url");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
  await connectToDatabase();

  const managed = option("manage") ? await Championship.findOne({ name: option("manage") }) : null;
  if (option("manage") && !managed) throw new Error(`No existe el torneo "${option("manage")}"`);

  const passwordHash = await bcrypt.hash(password, 10);
  let user = await User.findOne({ email });
  const existed = Boolean(user);
  if (user) {
    await User.updateOne({ _id: user._id }, { passwordHash, emailVerified: true });
  } else {
    user = await User.create({ email, name, passwordHash, roleId: await getDefaultRoleIdForNewUser(), emailVerified: true, isAdmin: false });
  }
  if (managed) await Championship.updateOne({ _id: managed._id }, { $addToSet: { organizerUserIds: user._id } });
  if (flag("demo")) await createDemoForUser(user._id.toString(), Number(option("demo")) || 14);

  console.log(`${existed ? "Contraseña actualizada" : "Cuenta creada"}: ${email} / ${password}`);
  if (managed) console.log(`Organiza: ${managed.name}`);
  await mongoose.disconnect();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

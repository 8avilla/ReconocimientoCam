import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import crypto from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return new Response("Token no proporcionado", { status: 400 });
  }

  await connectToDatabase();
  
  const tokenHash = hashToken(token);
  const user = await User.findOne({ emailVerificationTokenHash: tokenHash });

  if (!user) {
    return new Response("Enlace de verificación inválido o ya utilizado.", { status: 400 });
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  await user.save();

  // Redirigir a la página principal con un parámetro para mostrar un mensaje si se desea
  redirect("/?verified=true");
}

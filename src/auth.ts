import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { connectToDatabase } from "@/lib/db";
import { ensureDefaultRoles } from "@/lib/services/roles";
import { resolveOrganizerInvites } from "@/lib/services/users";
import { User } from "@/models/User";

declare module "next-auth" {
  interface Session {
    user: {
      /** The app's own User document id (not Google's account id). */
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    dbId?: string;
    isAdmin?: boolean;
  }
}

/** Emails that become admin the first time they sign in (comma-separated); can be edited by hand afterwards. */
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const providers: Provider[] = [
  Google({
    // Always ask which Google account, instead of silently reusing whichever is already signed into the browser.
    authorization: { params: { prompt: "select_account" } },
  }),
  Credentials({
    id: "credentials",
    name: "Correo y contraseña",
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;
      await connectToDatabase();
      const user = await User.findOne({ email }).select("email name image passwordHash").lean();
      // Same generic failure whether the email doesn't exist, has no password set (Google-only
      // account), or the password is wrong — never reveal which one, to avoid leaking real emails.
      if (!user?.passwordHash) return null;
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;
      return { id: user._id.toString(), email: user.email, name: user.name, image: user.image };
    },
  }),
];

// Only for automated testing (Playwright/API scripts), never shown as a button: it must be requested by
// name from a script, and is entirely absent unless explicitly turned on outside production.
if (process.env.ALLOW_TEST_LOGIN === "1" && process.env.NODE_ENV !== "production") {
  providers.push(
    Credentials({
      id: "test-login",
      name: "Test login (dev only)",
      credentials: { email: {}, name: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        if (!email) return null;
        return { id: email, email, name: String(credentials?.name ?? email) };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/" },
  callbacks: {
    // Runs on sign-in and on every subsequent request that reads the session: upserts the app's own User
    // document (by email) and carries its id/isAdmin in the token, so no DB call is needed to just read the session.
    async jwt({ token, user }: { token: JWT; user?: { email?: string | null; name?: string | null; image?: string | null } }) {
      if (user?.email) {
        await connectToDatabase();
        const email = user.email.toLowerCase();
        const isAdminEmail = ADMIN_EMAILS.has(email);
        // Only matters for a brand-new account (via $setOnInsert below) — an extra lookup on every sign-in
        // otherwise, but ensureDefaultRoles is a cheap idempotent upsert, not worth caching for this scale.
        const { championshipAdminRoleId } = await ensureDefaultRoles();
        const doc = await User.findOneAndUpdate(
          { email },
          {
            $set: { name: user.name ?? email, image: user.image ?? undefined },
            $setOnInsert: { isAdmin: isAdminEmail, roleId: championshipAdminRoleId },
          },
          { upsert: true, new: true }
        ).lean();
        token.dbId = doc._id.toString();
        // An admin promoted later by hand keeps it; being removed from ADMIN_EMAILS does not silently take it away.
        token.isAdmin = doc.isAdmin || isAdminEmail;
        // Resolve any "organize this championship" invites sent to this email before they ever signed in.
        await resolveOrganizerInvites(doc._id, email);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.dbId) session.user.id = token.dbId;
      session.user.isAdmin = token.isAdmin ?? false;
      return session;
    },
  },
});

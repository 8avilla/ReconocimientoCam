import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { connectToDatabase } from "@/lib/db";
import { Championship } from "@/models/Championship";
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
        const doc = await User.findOneAndUpdate(
          { email },
          { $set: { name: user.name ?? email, image: user.image ?? undefined }, $setOnInsert: { isAdmin: isAdminEmail } },
          { upsert: true, new: true }
        ).lean();
        token.dbId = doc._id.toString();
        // An admin promoted later by hand keeps it; being removed from ADMIN_EMAILS does not silently take it away.
        token.isAdmin = doc.isAdmin || isAdminEmail;
        // Resolve any "organize this championship" invites sent to this email before they ever signed in.
        await Championship.updateMany(
          { organizerInviteEmails: email },
          { $addToSet: { organizerUserIds: doc._id }, $pull: { organizerInviteEmails: email } }
        );
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

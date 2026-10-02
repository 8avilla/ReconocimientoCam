/**
 * Database helpers for the end-to-end tests (`npm run test:e2e`), run by them through tsx:
 *   tsx --env-file=.env.local scripts/e2e-db.ts create-user <email> <name> -> a verified email/password account (see E2E_PASSWORD)
 *   tsx --env-file=.env.local scripts/e2e-db.ts create-demo <email>   -> prints {"championshipId": "..."}
 *   tsx --env-file=.env.local scripts/e2e-db.ts cleanup               -> removes everything owned by zz-qa-* users
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { createDemoForUser, deleteDemo } from "@/lib/services/demo";
import { getDefaultRoleIdForNewUser } from "@/lib/services/roles";
import { purgeUserNotifications } from "@/lib/services/users";
import { Championship } from "@/models/Championship";
import { User } from "@/models/User";

const QA_PREFIX = "zz-qa-";
export const E2E_PASSWORD = "E2e-Password-1";

async function main() {
  const [command, email, name] = process.argv.slice(2);
  await connectToDatabase();
  if (command === "create-user") {
    if (!email?.startsWith(QA_PREFIX)) throw new Error(`Test emails start with ${QA_PREFIX}`);
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 4);
    await User.updateOne(
      { email },
      { $set: { passwordHash, emailVerified: true, name: name ?? email }, $setOnInsert: { email, isAdmin: false, roleId: await getDefaultRoleIdForNewUser() } },
      { upsert: true }
    );
    console.log(JSON.stringify({ email }));
  } else if (command === "create-demo") {
    const user = await User.findOne({ email });
    if (!user) throw new Error(`No user ${email}: sign in first`);
    const demo = await createDemoForUser(user._id.toString(), 1);
    if (!demo) throw new Error('No demo template: run `npm run demo:template -- "<championship name>"`');
    console.log(JSON.stringify({ championshipId: String(demo._id) }));
  } else if (command === "cleanup") {
    const users = await User.find({ email: new RegExp(`^${QA_PREFIX}`) }, "_id").lean();
    for (const { _id } of users) {
      for (const demo of await Championship.find({ demoOwnerUserId: _id }, "_id").lean()) await deleteDemo(demo._id);
      await purgeUserNotifications(_id.toString());
      await User.deleteOne({ _id });
    }
    console.log(JSON.stringify({ removedUsers: users.length }));
  } else {
    throw new Error("Unknown command");
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

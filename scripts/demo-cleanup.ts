/** Deletes every demo championship past its expiry. Usage: npm run demo:cleanup (also runs lazily when a demo is created). */
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { purgeExpiredDemos } from "@/lib/services/demo";

async function main() {
  await connectToDatabase();
  console.log(`Demos eliminadas: ${await purgeExpiredDemos()}`);
  await mongoose.disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});

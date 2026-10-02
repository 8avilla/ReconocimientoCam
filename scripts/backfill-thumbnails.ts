/**
 * Makes the small copy (`_s`) of every avatar image uploaded before copies existed, then you can turn on
 * NEXT_PUBLIC_IMAGE_THUMBS=1 (it is read when the app is built). Safe to repeat: images that have a copy are skipped,
 * nothing is deleted or changed, only new files are added to the storage container.
 * Usage: npm run thumbs
 */
import mongoose from "mongoose";
import { ensureThumbnail } from "@/lib/azureBlob";
import { connectToDatabase } from "@/lib/db";
import { Championship } from "@/models/Championship";
import { Player } from "@/models/Player";
import { Team } from "@/models/Team";

async function main() {
  await connectToDatabase();
  const [players, teams, championships] = await Promise.all([
    Player.find({}, "photoBlobName facePhotoBlobName").lean(),
    Team.find({}, "shieldBlobName").lean(),
    Championship.find({}, "logoBlobName").lean(),
  ]);
  const names = new Set<string>();
  for (const player of players) [player.photoBlobName, player.facePhotoBlobName].forEach((name) => name && names.add(name));
  for (const team of teams) if (team.shieldBlobName) names.add(team.shieldBlobName);
  for (const championship of championships) if (championship.logoBlobName) names.add(championship.logoBlobName);

  let made = 0;
  let failed = 0;
  for (const name of names) {
    try {
      if (await ensureThumbnail(name)) made += 1;
    } catch (error) {
      failed += 1;
      console.error(`Could not make a copy of ${name}:`, (error as Error).message);
    }
  }
  console.log(`${names.size} images checked, ${made} copies made, ${failed} failed.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

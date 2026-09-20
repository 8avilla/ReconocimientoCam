/**
 * Regenerates the face embedding of every player whose stored embedding comes from an older
 * pipeline version, using the official photo kept in Azure Blob. Usage: npm run reembed
 */
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { downloadImage } from "@/lib/azureBlob";
import { EMBEDDING_VERSION, embedFaceFromPhoto, FaceDetectionError } from "@/lib/faceEngine/embedding";
import { Player } from "@/models/Player";

async function main() {
  await connectToDatabase();
  const players = await Player.find({ photoBlobName: { $ne: "" }, embeddingVersion: { $ne: EMBEDDING_VERSION } })
    .select("+faceEmbedding")
    .exec();
  console.log(`Players to migrate: ${players.length}`);

  let updated = 0;
  const failed: string[] = [];
  for (const player of players) {
    try {
      const { embedding } = await embedFaceFromPhoto(await downloadImage(player.photoBlobName));
      player.faceEmbedding = Array.from(embedding);
      player.embeddingVersion = EMBEDDING_VERSION;
      await player.save();
      updated += 1;
    } catch (error) {
      const reason = error instanceof FaceDetectionError ? error.reason : error instanceof Error ? error.message : "unknown";
      failed.push(`${player.publicId} (${reason})`);
    }
  }
  console.log(`Updated: ${updated}`);
  if (failed.length > 0) console.log(`Needs manual re-enrollment (${failed.length}):\n  ${failed.join("\n  ")}`);
}

main()
  .catch((error) => {
    console.error("Re-embedding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

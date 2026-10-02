import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { THUMB_SIZE, thumbName } from "@/lib/thumbs";

let containerClient: ContainerClient | null = null;

function getContainerClient(): ContainerClient {
  if (!containerClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_DEFAULT_CONTAINER;
    if (!connectionString || !containerName) {
      throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_DEFAULT_CONTAINER");
    }
    containerClient = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName);
  }
  return containerClient;
}

export type ImageFolder =
  | "players/faces"
  | "players/photos"
  | "players/gallery"
  | "players/checkins"
  | "teams/shields"
  | "championships/logos"
  | "fines/receipts";

export interface UploadedImage {
  url: string;
  blobName: string;
}

/** Every upload gets a fresh random name and is never overwritten in place, so its content never changes. */
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Uploads an image buffer under a logical folder and returns its URL and blob name. */
export async function uploadImage(
  buffer: Buffer,
  folder: ImageFolder,
  contentType = "image/jpeg"
): Promise<UploadedImage> {
  const extension = contentType === "image/png" ? "png" : "jpg";
  const blobName = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const blockBlobClient = getContainerClient().getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: IMMUTABLE_CACHE_CONTROL } });
  // Avatars use a small copy (see `lib/thumbs.ts`). Failing to make it never fails the upload: the original is used instead.
  await uploadThumbnail(buffer, blobName, contentType).catch((error) => console.error("Failed to store thumbnail:", error));
  return { url: blockBlobClient.url, blobName };
}

/** Stores the small copy of an image that is shown as an avatar; does nothing for other kinds of image. */
async function uploadThumbnail(buffer: Buffer, blobName: string, contentType: string): Promise<boolean> {
  const name = thumbName(blobName);
  if (!name) return false;
  const pipeline = sharp(buffer).rotate().resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "inside", withoutEnlargement: true });
  const small = contentType === "image/png" ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 80 }).toBuffer();
  await getContainerClient().getBlockBlobClient(name).uploadData(small, { blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: IMMUTABLE_CACHE_CONTROL } });
  return true;
}

/** Makes the small copy of an image uploaded before copies existed (`npm run thumbs`). Returns whether one was made. */
export async function ensureThumbnail(blobName: string): Promise<boolean> {
  const name = thumbName(blobName);
  if (!name || (await getContainerClient().getBlockBlobClient(name).exists())) return false;
  return uploadThumbnail(await downloadImage(blobName), blobName, blobName.endsWith(".png") ? "image/png" : "image/jpeg");
}

/** Deletes a blob (and its small copy) if it exists; used when biometric data or images are replaced or removed. */
export async function deleteImage(blobName: string): Promise<void> {
  await getContainerClient().getBlockBlobClient(blobName).deleteIfExists();
  const thumb = thumbName(blobName);
  if (thumb) await getContainerClient().getBlockBlobClient(thumb).deleteIfExists();
}

/** Downloads a stored image, e.g. to regenerate its face embedding. */
export async function downloadImage(blobName: string): Promise<Buffer> {
  return getContainerClient().getBlockBlobClient(blobName).downloadToBuffer();
}

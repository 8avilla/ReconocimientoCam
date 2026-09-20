import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";

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

export type ImageFolder = "players/faces" | "players/checkins" | "teams/shields";

export interface UploadedImage {
  url: string;
  blobName: string;
}

/** Uploads an image buffer under a logical folder and returns its URL and blob name. */
export async function uploadImage(
  buffer: Buffer,
  folder: ImageFolder,
  contentType = "image/jpeg"
): Promise<UploadedImage> {
  const extension = contentType === "image/png" ? "png" : "jpg";
  const blobName = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const blockBlobClient = getContainerClient().getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  return { url: blockBlobClient.url, blobName };
}

/** Deletes a blob if it exists; used when biometric data or images are replaced or removed. */
export async function deleteImage(blobName: string): Promise<void> {
  await getContainerClient().getBlockBlobClient(blobName).deleteIfExists();
}

/** Downloads a stored image, e.g. to regenerate its face embedding. */
export async function downloadImage(blobName: string): Promise<Buffer> {
  return getContainerClient().getBlockBlobClient(blobName).downloadToBuffer();
}

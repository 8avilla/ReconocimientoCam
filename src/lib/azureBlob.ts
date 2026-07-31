import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";

let containerClientPromise: ReturnType<BlobServiceClient["getContainerClient"]> | null = null;

function getContainerClient() {
  if (!containerClientPromise) {
    const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const CONTAINER_NAME = process.env.AZURE_STORAGE_DEFAULT_CONTAINER;
    if (!CONNECTION_STRING || !CONTAINER_NAME) {
      throw new Error("Faltan AZURE_STORAGE_CONNECTION_STRING o AZURE_STORAGE_DEFAULT_CONTAINER");
    }
    const service = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    containerClientPromise = service.getContainerClient(CONTAINER_NAME);
  }
  return containerClientPromise;
}

/** Sube una foto (buffer JPEG) bajo un prefijo lógico y devuelve la URL pública del blob. */
export async function uploadAttendancePhoto(buffer: Buffer, prefix: "enroll" | "checkin"): Promise<string> {
  const container = getContainerClient();
  const blobName = `attendance/${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.jpg`;
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: "image/jpeg" },
  });
  return blockBlobClient.url;
}

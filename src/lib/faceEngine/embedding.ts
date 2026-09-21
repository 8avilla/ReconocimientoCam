import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "path";
import { alignFace, ALIGNED_SIZE } from "./align";
import { decodeRgb, detectFaces, padRgb, warmDetector, type DetectedFace } from "./detector";

/** Margin added around tight crops when the first detection attempt finds nothing. */
const RETRY_MARGIN_RATIO = 0.5;

/**
 * Version of the embedding pipeline. Bump it whenever preprocessing changes: vectors from different
 * versions are not comparable and must be regenerated (see scripts/reembed-faces.ts).
 * 1 = crop stretched to 112x112 (legacy), 2 = SCRFD detection + 5-point ArcFace alignment.
 */
export const EMBEDDING_VERSION = 2;

const MODEL_PATH = path.join(process.cwd(), "models_onnx", "w600k_r50.onnx");

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_PATH);
  }
  return sessionPromise;
}

/** Loads the detector and embedding models so the first identification is not slow. */
export async function warmFaceEngine(): Promise<void> {
  await Promise.all([getSession(), warmDetector()]);
}

/** Raised when the image has no detectable face, or more than one. */
export class FaceDetectionError extends Error {
  constructor(public readonly reason: "no_face" | "multiple_faces", message: string) {
    super(message);
    this.name = "FaceDetectionError";
  }
}

/** Embeds an aligned 112x112 RGB crop (raw, 3 bytes per pixel) into a normalized 512-d vector. */
export async function getEmbeddingFromRgb(rgb: Uint8Array): Promise<Float32Array> {
  // rgb is HWC (RGB); the model expects NCHW normalized to [-1, 1].
  const chw = new Float32Array(3 * ALIGNED_SIZE * ALIGNED_SIZE);
  const plane = ALIGNED_SIZE * ALIGNED_SIZE;
  for (let i = 0; i < plane; i++) {
    chw[i] = (rgb[i * 3] - 127.5) / 127.5;
    chw[plane + i] = (rgb[i * 3 + 1] - 127.5) / 127.5;
    chw[2 * plane + i] = (rgb[i * 3 + 2] - 127.5) / 127.5;
  }

  const session = await getSession();
  const tensor = new ort.Tensor("float32", chw, [1, 3, ALIGNED_SIZE, ALIGNED_SIZE]);
  const results = await session.run({ [session.inputNames[0]]: tensor });
  return l2Normalize(results[session.outputNames[0]].data as Float32Array);
}

/**
 * Legacy path: takes an already cropped face image (any size) and stretches it to 112x112
 * without detection or alignment. Kept for comparison in calibration.
 */
export async function getEmbeddingFromImage(imageBuffer: Buffer): Promise<Float32Array> {
  const { data } = await sharp(imageBuffer)
    .resize(ALIGNED_SIZE, ALIGNED_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return getEmbeddingFromRgb(data);
}

export interface EmbeddedFace {
  embedding: Float32Array;
  face: DetectedFace;
}

/**
 * Detects the face in a photo, aligns it to the ArcFace template and embeds it.
 * Throws FaceDetectionError when there is no face or more than one prominent face.
 */
export async function embedFaceFromPhoto(imageBuffer: Buffer, options: { padFirst?: boolean } = {}): Promise<EmbeddedFace> {
  let image = await decodeRgb(imageBuffer);
  let faces: DetectedFace[] = [];
  if (options.padFirst) {
    // Browser crops are tight and the detector nearly always misses them unpadded: skip that wasted pass (~1/3 of the time).
    const padded = padRgb(image, RETRY_MARGIN_RATIO);
    faces = await detectFaces(padded);
    if (faces.length > 0) image = padded;
  }
  if (faces.length === 0) faces = await detectFaces(image);
  if (faces.length === 0 && !options.padFirst) {
    // Tight crops (as sent by the browser) often lack the context the detector needs.
    image = padRgb(image, RETRY_MARGIN_RATIO);
    faces = await detectFaces(image);
  }
  if (faces.length === 0) throw new FaceDetectionError("no_face", "No se detectó ningún rostro en la imagen");

  const area = (face: DetectedFace) => (face.box[2] - face.box[0]) * (face.box[3] - face.box[1]);
  const [main, ...others] = [...faces].sort((a, b) => area(b) - area(a));
  // A second face of comparable size means we cannot tell whose face it is.
  if (others.some((other) => area(other) > area(main) * 0.5)) {
    throw new FaceDetectionError("multiple_faces", "Se detectó más de un rostro en la imagen");
  }
  return { embedding: await getEmbeddingFromRgb(alignFace(image, main.landmarks)), face: main };
}

function l2Normalize(vec: Float32Array): Float32Array {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both are normalized, so the dot product is the cosine similarity
}

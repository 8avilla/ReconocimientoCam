import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "path";

const MODEL_PATH = path.join(process.cwd(), "models_onnx", "w600k_r50.onnx");

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_PATH);
  }
  return sessionPromise;
}

/** Recibe una imagen (buffer PNG/JPEG) ya recortada al rostro y devuelve el embedding normalizado (512-d). */
export async function getEmbeddingFromImage(imageBuffer: Buffer): Promise<Float32Array> {
  const { data } = await sharp(imageBuffer)
    .resize(112, 112, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // data viene HWC (RGB), el modelo espera NCHW normalizado a [-1, 1]
  const chw = new Float32Array(3 * 112 * 112);
  const plane = 112 * 112;
  for (let i = 0; i < plane; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    chw[i] = (r - 127.5) / 127.5;
    chw[plane + i] = (g - 127.5) / 127.5;
    chw[2 * plane + i] = (b - 127.5) / 127.5;
  }

  const session = await getSession();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const tensor = new ort.Tensor("float32", chw, [1, 3, 112, 112]);
  const results = await session.run({ [inputName]: tensor });
  const embedding = results[outputName].data as Float32Array;

  return l2Normalize(embedding);
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
  return dot; // ya vienen normalizados, el producto punto = similitud coseno
}

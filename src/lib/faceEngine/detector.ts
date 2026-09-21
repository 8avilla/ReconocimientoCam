import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "path";

/** SCRFD (InsightFace det_10g) face detector: box + 5 landmarks per face. */

const MODEL_PATH = path.join(process.cwd(), "models_onnx", "det_10g.onnx");
const INPUT_SIZE = 640;
const STRIDES = [8, 16, 32] as const;
const ANCHORS_PER_CELL = 2;
const SCORE_THRESHOLD = 0.5;
const NMS_IOU_THRESHOLD = 0.4;
// Output order of det_10g: scores per stride, then boxes per stride, then landmarks per stride.
const OUTPUT_INDEX = { score: 0, box: 3, landmarks: 6 } as const;

export type Point = [number, number];

export interface DetectedFace {
  /** [x1, y1, x2, y2] in source-image pixels. */
  box: [number, number, number, number];
  score: number;
  /** left eye, right eye, nose, left mouth corner, right mouth corner. */
  landmarks: [Point, Point, Point, Point, Point];
}

/** A decoded RGB image (row-major, 3 bytes per pixel). */
export interface RgbImage {
  data: Buffer;
  width: number;
  height: number;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;
function getSession() {
  if (!sessionPromise) sessionPromise = ort.InferenceSession.create(MODEL_PATH);
  return sessionPromise;
}

/** Loads the detector model ahead of the first request. */
export const warmDetector = () => getSession();

/** Decodes any supported image (applying EXIF orientation) to raw RGB. */
export async function decodeRgb(buffer: Buffer): Promise<RgbImage> {
  const { data, info } = await sharp(buffer).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Surrounds the image with a neutral gray margin. The browser sends tight face crops, and SCRFD
 * needs some context around a face to detect it; landmarks found on the padded image are used as is.
 */
export function padRgb(image: RgbImage, marginRatio: number): RgbImage {
  const margin = Math.round(Math.max(image.width, image.height) * marginRatio);
  const width = image.width + margin * 2;
  const height = image.height + margin * 2;
  const data = Buffer.alloc(width * height * 3, 128);
  for (let y = 0; y < image.height; y++) {
    image.data.copy(data, ((y + margin) * width + margin) * 3, y * image.width * 3, (y + 1) * image.width * 3);
  }
  return { data, width, height };
}

export async function detectFaces(image: RgbImage): Promise<DetectedFace[]> {
  // Letterbox: scale to fit the square input, keep aspect ratio, pad bottom/right with black.
  const scale = Math.min(INPUT_SIZE / image.width, INPUT_SIZE / image.height);
  const resizedWidth = Math.max(1, Math.round(image.width * scale));
  const resizedHeight = Math.max(1, Math.round(image.height * scale));
  const resized = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 3 } })
    .resize(resizedWidth, resizedHeight, { fit: "fill" })
    .raw()
    .toBuffer();

  const plane = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * plane); // zero-padded == (0 - 127.5) / 128 handled below
  input.fill(-127.5 / 128);
  for (let y = 0; y < resizedHeight; y++) {
    for (let x = 0; x < resizedWidth; x++) {
      const src = (y * resizedWidth + x) * 3;
      const dst = y * INPUT_SIZE + x;
      input[dst] = (resized[src] - 127.5) / 128;
      input[plane + dst] = (resized[src + 1] - 127.5) / 128;
      input[2 * plane + dst] = (resized[src + 2] - 127.5) / 128;
    }
  }

  const session = await getSession();
  const outputs = await session.run({
    [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  });
  const read = (index: number) => outputs[session.outputNames[index]].data as Float32Array;

  const candidates: DetectedFace[] = [];
  STRIDES.forEach((stride, level) => {
    const scores = read(OUTPUT_INDEX.score + level);
    const boxes = read(OUTPUT_INDEX.box + level);
    const landmarks = read(OUTPUT_INDEX.landmarks + level);
    const cells = INPUT_SIZE / stride;

    for (let index = 0; index < scores.length; index++) {
      if (scores[index] < SCORE_THRESHOLD) continue;
      const cell = Math.floor(index / ANCHORS_PER_CELL);
      const centerX = (cell % cells) * stride;
      const centerY = Math.floor(cell / cells) * stride;

      const box: DetectedFace["box"] = [
        (centerX - boxes[index * 4] * stride) / scale,
        (centerY - boxes[index * 4 + 1] * stride) / scale,
        (centerX + boxes[index * 4 + 2] * stride) / scale,
        (centerY + boxes[index * 4 + 3] * stride) / scale,
      ];
      const points = Array.from({ length: 5 }, (_, k): Point => [
        (centerX + landmarks[index * 10 + k * 2] * stride) / scale,
        (centerY + landmarks[index * 10 + k * 2 + 1] * stride) / scale,
      ]) as DetectedFace["landmarks"];
      candidates.push({ box, score: scores[index], landmarks: points });
    }
  });

  return nonMaxSuppression(candidates);
}

function iou(a: DetectedFace["box"], b: DetectedFace["box"]): number {
  const width = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const height = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const intersection = width * height;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function nonMaxSuppression(faces: DetectedFace[]): DetectedFace[] {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const kept: DetectedFace[] = [];
  for (const face of sorted) {
    if (kept.every((other) => iou(face.box, other.box) < NMS_IOU_THRESHOLD)) kept.push(face);
  }
  return kept;
}

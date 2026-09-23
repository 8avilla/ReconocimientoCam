"use client";

import { FilesetResolver, FaceLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm";

// El WASM de MediaPipe escribe sus logs internos (incluso "INFO") por stderr,
// que Emscripten mapea a console.error. En `next dev`, Next.js parchea
// console.error para su overlay de errores, y ese parche es incompatible con
// esa escritura interna (crashea en put_char/fd_write). Como no nos interesan
// esos logs, los silenciamos solo mientras corre la llamada síncrona.
export function withSilencedConsole<T>(fn: () => T): T {
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  }
}

// Versión async: el WASM puede capturar su referencia a console.error/console.info
// durante la instanciación (dentro de la promesa), no solo en la llamada síncrona
// inicial, así que hay que mantener el silencio hasta que la promesa resuelva.
async function withSilencedConsoleAsync<T>(fn: () => Promise<T>): Promise<T> {
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  }
}

// Singleton a nivel de módulo: evita crear dos instancias del módulo WASM en
// paralelo (p. ej. por el doble-montaje de efectos de React StrictMode en dev),
// lo cual corrompe el estado interno del módulo y lanza errores en put_char/fd_write.
// Compartido entre la cámara en vivo (FaceCapture) y la detección sobre una foto fija.
let landmarkerPromise: Promise<FaceLandmarker> | null = null;
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = withSilencedConsoleAsync(async () => {
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe-models/face_landmarker.task",
          // "GPU" falla en varios navegadores/móviles (delegado WebGL no soportado);
          // "CPU" es más lento pero mucho más compatible.
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    });
  }
  return landmarkerPromise;
}

/** Starts loading the detector (WASM + model) so opening the camera later is instant. */
export function preloadFaceDetector(): Promise<unknown> {
  return getLandmarker();
}

/** Side (px) of the square face crop sent to the server; the embedding model downsizes it itself. */
export const CROP_SIZE = 320;
/** Side (px) of the looser "ID card" crop: same shot, more headroom around the face. */
export const CARNET_CROP_SIZE = 480;
/** How much bigger the ID card crop is than the tight face box (which already has its own padding). */
export const CARNET_SCALE = 1.6;
/** Extra margin kept around the detected landmarks for the tight face crop. */
const FACE_PAD = 0.35;

export interface Bbox {
  x: number;
  y: number;
  size: number;
}

/** Square bounding box (in source pixels) around a set of normalized landmarks, with padding. */
export function bboxFromLandmarks(landmarks: readonly NormalizedLandmark[], width: number, height: number, pad = FACE_PAD): Bbox {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of landmarks) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const cx = ((minX + maxX) / 2) * width;
  const cy = ((minY + maxY) / 2) * height;
  const size = Math.max(maxX - minX, maxY - minY) * width * (1 + pad);
  return { x: cx - size / 2, y: cy - size / 2, size };
}

/** Draws a square crop of the source, clamped inside its frame, downsized to `outputSize`. */
export function drawSquareCrop(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  cx: number,
  cy: number,
  size: number,
  outputSize: number
): string {
  const clamped = Math.min(size, sourceWidth, sourceHeight);
  const x = Math.min(Math.max(cx - clamped / 2, 0), sourceWidth - clamped);
  const y = Math.min(Math.max(cy - clamped / 2, 0), sourceHeight - clamped);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  canvas.getContext("2d")!.drawImage(source, x, y, clamped, clamped, 0, 0, outputSize, outputSize);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Both crops of the same shot: tight (verification reference) and loose (ID card / avatar). */
export function captureCrops(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, bbox: Bbox): { face: string; carnet: string } {
  const cx = bbox.x + bbox.size / 2;
  const cy = bbox.y + bbox.size / 2;
  return {
    face: drawSquareCrop(source, sourceWidth, sourceHeight, cx, cy, bbox.size, CROP_SIZE),
    carnet: drawSquareCrop(source, sourceWidth, sourceHeight, cx, cy, bbox.size * CARNET_SCALE, CARNET_CROP_SIZE),
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = dataUrl;
  });
}

/**
 * Runs face detection on a still image (not the live camera) and returns the same two crops the
 * live capture produces, or null when no face is found. Used to enroll biometrics from an existing
 * photo instead of a fresh camera capture.
 */
export async function detectFaceCropsInImage(dataUrl: string): Promise<{ face: string; carnet: string } | null> {
  const landmarker = await getLandmarker();
  const image = await loadImage(dataUrl);
  // The live camera uses "VIDEO" mode (detectForVideo); a still image needs "IMAGE" mode (detect).
  // Restored to "VIDEO" afterwards since that's what the live capture flow expects from the shared singleton.
  await landmarker.setOptions({ runningMode: "IMAGE" });
  let result;
  try {
    result = withSilencedConsole(() => landmarker.detect(image));
  } finally {
    await landmarker.setOptions({ runningMode: "VIDEO" });
  }
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const bbox = bboxFromLandmarks(landmarks, width, height);
  return captureCrops(image, width, height, bbox);
}

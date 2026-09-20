"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm";

// El WASM de MediaPipe escribe sus logs internos (incluso "INFO") por stderr,
// que Emscripten mapea a console.error. En `next dev`, Next.js parchea
// console.error para su overlay de errores, y ese parche es incompatible con
// esa escritura interna (crashea en put_char/fd_write). Como no nos interesan
// esos logs, los silenciamos solo mientras corre la llamada síncrona.
function withSilencedConsole<T>(fn: () => T): T {
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
let landmarkerPromise: Promise<FaceLandmarker> | null = null;
function getLandmarker(): Promise<FaceLandmarker> {
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

interface FaceCaptureProps {
  /** Receives the face crop as a JPEG data URL. */
  onCapture: (imageBase64: string) => void;
  busy?: boolean;
  buttonLabel?: string;
}

/** Side (px) of the square face crop sent to the server; the embedding model downsizes it itself. */
const CROP_SIZE = 320;

export default function FaceCapture({ onCapture, busy, buttonLabel = "Capturar foto" }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const bboxRef = useRef<{ x: number; y: number; size: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastTimestampRef = useRef(0);

  const [status, setStatus] = useState("Iniciando cámara...");
  const [faceReady, setFaceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function setup() {
      const landmarker = await getLandmarker();
      if (cancelled) return;
      landmarkerRef.current = landmarker;

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 480 },
        audio: false,
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("Buscando rostro...");
      loop();
    }

    function loop() {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !overlay || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Solo procesar cuando llega un frame nuevo de la cámara (patrón oficial
      // de MediaPipe): llamar a detectForVideo más rápido de lo que hay frames
      // nuevos puede solapar llamadas y corromper el estado interno del WASM.
      if (video.currentTime === lastVideoTimeRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastVideoTimeRef.current = video.currentTime;

      const timestamp = Math.max(performance.now(), lastTimestampRef.current + 1);
      lastTimestampRef.current = timestamp;

      const result = withSilencedConsole(() => landmarker.detectForVideo(video, timestamp));
      const ctx = overlay.getContext("2d")!;
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const landmarks = result.faceLandmarks?.[0];
      if (landmarks && landmarks.length > 0) {
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const p of landmarks) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        const w = video.videoWidth;
        const h = video.videoHeight;
        const pad = 0.35; // margen extra alrededor del rostro
        const cx = ((minX + maxX) / 2) * w;
        const cy = ((minY + maxY) / 2) * h;
        const size = Math.max(maxX - minX, maxY - minY) * w * (1 + pad);

        bboxRef.current = { x: cx - size / 2, y: cy - size / 2, size };

        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

        setFaceReady(true);
        setStatus("Rostro detectado");
      } else {
        bboxRef.current = null;
        setFaceReady(false);
        setStatus("Buscando rostro...");
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    setup().catch((err) => {
      console.error(err);
      setStatus(cameraErrorMessage(err));
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // No cerramos el landmarker: es un singleton compartido entre montajes.
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const bbox = bboxRef.current;
    if (!video || !bbox) return;

    const crop = document.createElement("canvas");
    crop.width = CROP_SIZE;
    crop.height = CROP_SIZE;
    crop.getContext("2d")!.drawImage(video, bbox.x, bbox.y, bbox.size, bbox.size, 0, 0, CROP_SIZE, CROP_SIZE);
    onCapture(crop.toDataURL("image/jpeg", 0.92));
  }, [onCapture]);

  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", borderRadius: "var(--radius-lg)", transform: "scaleX(-1)", background: "var(--color-navy)", aspectRatio: "1 / 1", objectFit: "cover" }}
        />
        <canvas
          ref={overlayRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)" }}
        />
      </div>
      <p className="text-secondary" role="status">{status}</p>
      <button
        type="button"
        className="btn primary large block"
        style={{ maxWidth: 420 }}
        onClick={handleCapture}
        disabled={!faceReady || busy}
      >
        {busy ? "Procesando..." : buttonLabel}
      </button>
    </div>
  );
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "No hay permiso para usar la cámara. Habilítalo en el navegador (requiere HTTPS).";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No se encontró una cámara en este dispositivo.";
  }
  console.error("Camera or face model initialization failed:", error);
  return "No se pudo iniciar la cámara o el modelo de detección.";
}

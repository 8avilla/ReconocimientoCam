"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm";

// Singleton a nivel de módulo: evita crear dos instancias del módulo WASM en
// paralelo (p. ej. por el doble-montaje de efectos de React StrictMode en dev),
// lo cual corrompe el estado interno del módulo y lanza errores en put_char/fd_write.
let landmarkerPromise: Promise<FaceLandmarker> | null = null;
function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL).then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe-models/face_landmarker.task",
          // "GPU" falla en varios navegadores/móviles (delegado WebGL no soportado);
          // "CPU" es más lento pero mucho más compatible.
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      })
    );
  }
  return landmarkerPromise;
}

export type Coords = { lat: number; lng: number; accuracy: number };

type Props = {
  onCapture: (imageBase64: string, coords: Coords | null) => void;
  busy?: boolean;
  buttonLabel?: string;
};

function getCoords(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export default function FaceCapture({ onCapture, busy, buttonLabel = "Capturar" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const bboxRef = useRef<{ x: number; y: number; size: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastTimestampRef = useRef(0);

  const [status, setStatus] = useState("Inicializando cámara...");
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

      const result = landmarker.detectForVideo(video, timestamp);
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

        ctx.strokeStyle = "#22c55e";
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
      setStatus("Error iniciando cámara/modelo: " + err.message);
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // No cerramos el landmarker: es un singleton compartido entre montajes.
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    const bbox = bboxRef.current;
    if (!video || !bbox) return;

    const crop = document.createElement("canvas");
    crop.width = 112;
    crop.height = 112;
    const ctx = crop.getContext("2d")!;
    ctx.drawImage(
      video,
      bbox.x,
      bbox.y,
      bbox.size,
      bbox.size,
      0,
      0,
      112,
      112
    );
    const imageBase64 = crop.toDataURL("image/jpeg", 0.92);
    const coords = await getCoords();
    onCapture(imageBase64, coords);
  }, [onCapture]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative", width: 480, maxWidth: "90vw" }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", borderRadius: 12, transform: "scaleX(-1)" }}
        />
        <canvas
          ref={overlayRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            transform: "scaleX(-1)",
          }}
        />
      </div>
      <p>{status}</p>
      <button
        onClick={handleCapture}
        disabled={!faceReady || busy}
        style={{
          padding: "10px 24px",
          borderRadius: 8,
          background: faceReady ? "#22c55e" : "#9ca3af",
          color: "white",
          border: "none",
          cursor: faceReady ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "Procesando..." : buttonLabel}
      </button>
    </div>
  );
}

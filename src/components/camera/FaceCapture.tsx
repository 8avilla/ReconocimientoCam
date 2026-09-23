"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SwitchCamera } from "lucide-react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { bboxFromLandmarks, captureCrops, getLandmarker, withSilencedConsole } from "./faceCrop";

const FACING_KEY = "super-torneos:camera-facing";

interface FaceCaptureProps {
  /**
   * Receives two crops of the same shot: a tight one on the face (verification reference, same as
   * before) and a looser one with more headroom (for the ID card / avatar). Callers that only need
   * one (attendance, 1:1 verification) can ignore the second parameter.
   */
  onCapture: (imageBase64: string, carnetImageBase64: string) => void;
  busy?: boolean;
  buttonLabel?: string;
  /** Captures by itself once a face has stayed in view for a moment (no button); used for attendance by camera. */
  auto?: boolean;
  /** While true no automatic capture happens (the face in view was already handled). */
  hold?: boolean;
  /** The face in view left or was replaced by another one: the hold can be released. */
  onFaceLost?: () => void;
}

/** A face must stay in view this long before an automatic capture, and captures are spaced by the cooldown. */
const AUTO_STABLE_MS = 700;
const AUTO_COOLDOWN_MS = 1800;
/** Time without a face after which the person is considered gone. */
const FACE_LOST_MS = 600;

export default function FaceCapture({ onCapture, busy, buttonLabel = "Capturar foto", auto = false, hold = false, onFaceLost }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const bboxRef = useRef<{ x: number; y: number; size: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastTimestampRef = useRef(0);
  // Latest props for the animation loop, which lives in an effect that must not restart on every render.
  const onCaptureRef = useRef(onCapture);
  const busyRef = useRef(busy);
  const autoRef = useRef(auto);
  const faceSinceRef = useRef<number | null>(null);
  const holdRef = useRef(hold);
  const onFaceLostRef = useRef(onFaceLost);
  /** Last face seen: used to tell "the same person still standing there" from "someone else". */
  const trackRef = useRef<{ cx: number; cy: number; size: number; seenAt: number } | null>(null);
  const nextAutoRef = useRef(0);
  useEffect(() => {
    onCaptureRef.current = onCapture;
    busyRef.current = busy;
    autoRef.current = auto;
    holdRef.current = hold;
    onFaceLostRef.current = onFaceLost;
  });

  const [status, setStatus] = useState("Iniciando cámara...");
  const [faceReady, setFaceReady] = useState(false);
  // Front camera by default (selfie); the rear one is handy when photographing someone else.
  const [facing, setFacing] = useState<"user" | "environment">(() => {
    try {
      return window.localStorage.getItem(FACING_KEY) === "environment" ? "environment" : "user";
    } catch {
      return "user";
    }
  });
  const [canSwitch, setCanSwitch] = useState(false);

  const switchCamera = () => {
    const next = facing === "user" ? "environment" : "user";
    try {
      window.localStorage.setItem(FACING_KEY, next);
    } catch {
      // Not remembered when storage is unavailable.
    }
    setFaceReady(false);
    setStatus("Cambiando de cámara...");
    setFacing(next);
  };

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function setup() {
      const landmarker = await getLandmarker();
      if (cancelled) return;
      landmarkerRef.current = landmarker;

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: 480, height: 480 },
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
      // Device labels/ids are only available once the camera permission was granted.
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
      if (!cancelled) setCanSwitch(cameras.length > 1);
      lastVideoTimeRef.current = -1;
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
        const w = video.videoWidth;
        const h = video.videoHeight;
        const bbox = bboxFromLandmarks(landmarks, w, h);
        const { size } = bbox;
        const cx = bbox.x + size / 2;
        const cy = bbox.y + size / 2;

        bboxRef.current = bbox;

        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

        setFaceReady(true);
        setStatus("Rostro detectado");

        // Attendance by camera: capture without pressing anything once the face is steady.
        const now = performance.now();
        // A big jump of the face box means another person: release the hold and start counting again.
        const previous = trackRef.current;
        if (previous && Math.hypot(cx - previous.cx, cy - previous.cy) > previous.size * 0.6) {
          faceSinceRef.current = null;
          onFaceLostRef.current?.();
        }
        trackRef.current = { cx, cy, size, seenAt: now };
        faceSinceRef.current ??= now;
        if (autoRef.current && !busyRef.current && !holdRef.current && now - faceSinceRef.current >= AUTO_STABLE_MS && now >= nextAutoRef.current) {
          nextAutoRef.current = now + AUTO_COOLDOWN_MS;
          const crops = captureCrops(video, video.videoWidth, video.videoHeight, bbox);
          onCaptureRef.current(crops.face, crops.carnet);
        }
      } else {
        // A single missed frame (a blink, a bit of motion blur, a brief MediaPipe hiccup) is not the
        // face leaving: keep the button enabled and the last good box usable for a short grace period,
        // otherwise "Rostro detectado" flickers on and off and the capture button seems to disappear.
        const goneForMs = trackRef.current ? performance.now() - trackRef.current.seenAt : Infinity;
        if (goneForMs > FACE_LOST_MS) {
          bboxRef.current = null;
          if (trackRef.current) {
            trackRef.current = null;
            faceSinceRef.current = null;
            onFaceLostRef.current?.();
          }
          setFaceReady(false);
          setStatus("Buscando rostro...");
        }
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
  }, [facing]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const bbox = bboxRef.current;
    if (!video || !bbox) return;

    const crops = captureCrops(video, video.videoWidth, video.videoHeight, bbox);
    onCapture(crops.face, crops.carnet);
  }, [onCapture]);

  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", borderRadius: "var(--radius-lg)", transform: facing === "user" ? "scaleX(-1)" : undefined, background: "var(--color-navy)", aspectRatio: "1 / 1", objectFit: "cover" }}
        />
        <canvas
          ref={overlayRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: facing === "user" ? "scaleX(-1)" : undefined }}
        />
      </div>
      <p className="text-secondary" role="status">{status}</p>
      {canSwitch && (
        <button type="button" className="btn secondary block" style={{ maxWidth: 420 }} onClick={switchCamera} disabled={busy}>
          <SwitchCamera size={18} aria-hidden /> {facing === "user" ? "Usar cámara trasera" : "Usar cámara frontal"}
        </button>
      )}
      {!auto && (
        <button
          type="button"
          className="btn primary large block"
          style={{ maxWidth: 420 }}
          onClick={handleCapture}
          disabled={!faceReady || busy}
        >
          {busy ? "Procesando..." : buttonLabel}
        </button>
      )}
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

export { preloadFaceDetector } from "./faceCrop";

"use client";

import { useEffect, useRef, useState } from "react";
import { decodeQr } from "@/lib/client/qr";

interface Props {
  /** Called once with the decoded text; the camera stops afterwards. */
  onDetect: (code: string) => void;
}

const SCAN_INTERVAL_MS = 120;

export function QrScanner({ onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [message, setMessage] = useState("Iniciando cámara...");

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");

    function scan() {
      const video = videoRef.current;
      if (cancelled || !video) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context?.getImageData(0, 0, canvas.width, canvas.height);
        const code = frame ? decodeQr(frame) : null;
        if (code) {
          cancelled = true;
          stream?.getTracks().forEach((track) => track.stop());
          onDetectRef.current(code);
          return;
        }
      }
      timer = setTimeout(scan, SCAN_INTERVAL_MS);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
        setMessage("Ubica el código QR dentro del recuadro");
        scan();
      })
      .catch((error: unknown) => setMessage(cameraMessage(error)));

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "var(--radius-lg)", background: "var(--color-navy)" }}
        />
        <div
          aria-hidden
          style={{ position: "absolute", inset: "18%", border: "3px solid var(--color-primary)", borderRadius: "var(--radius-lg)", pointerEvents: "none" }}
        />
      </div>
      <p className="text-secondary" role="status" style={{ textAlign: "center" }}>{message}</p>
    </div>
  );
}

function cameraMessage(error: unknown): string {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "No hay permiso para usar la cámara. Habilítalo en el navegador (requiere HTTPS) o ingresa el código manualmente.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No se encontró una cámara. Ingresa el código manualmente.";
  }
  console.error("QR scanner camera failed:", error);
  return "No se pudo iniciar la cámara. Ingresa el código manualmente.";
}

"use client";

import { useEffect, useRef, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  onCapture: (imageBase64: string) => void;
  onCancel: () => void;
}

/** Plain live camera preview + snapshot, with no face detection: for general (non-biometric) photos. */
export function SimpleCameraCapture({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [canSwitch, setCanSwitch] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Iniciando cámara...");

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function setup() {
      setReady(false);
      setStatus("Iniciando cámara...");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // Device labels/ids are only available once the camera permission was granted.
        const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        if (cancelled) return;
        setCanSwitch(cameras.length > 1);
        setReady(true);
        setStatus("");
      } catch (error) {
        if (!cancelled) setStatus(cameraErrorMessage(error));
      }
    }

    setup();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

  function capture() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.9));
  }

  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-navy)",
            aspectRatio: "1 / 1",
            objectFit: "cover",
            transform: facing === "user" ? "scaleX(-1)" : undefined,
          }}
        />
      </div>
      {status && <p className="text-secondary" role="status">{status}</p>}
      <div className="row-wrap">
        {canSwitch && (
          <Button variant="secondary" icon={<SwitchCamera size={18} />} onClick={() => setFacing((current) => (current === "user" ? "environment" : "user"))}>
            Cambiar cámara
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button size="large" disabled={!ready} onClick={capture}>Tomar foto</Button>
      </div>
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
  console.error("Camera initialization failed:", error);
  return "No se pudo iniciar la cámara.";
}

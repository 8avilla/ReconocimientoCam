"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, ImageUp, RefreshCw } from "lucide-react";
import { Button, Loading, useToast } from "@/components/ui";
import { errorMessage } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";

// MediaPipe (WASM) only runs in the browser.
const FaceCapture = dynamic(() => import("@/components/camera/FaceCapture"), { ssr: false, loading: () => <Loading /> });

const PHOTO_TIPS = ["Buena iluminación", "Rostro descubierto", "Sin gafas ni gorra", "Una sola persona"];

export interface CapturedFace {
  /** Tight crop: the embedding's source, also the reference photo shown during manual review. */
  face: string;
  /** Looser crop of the same shot: the player's photo everywhere else (ID card, avatars, lists). */
  carnet: string;
}

interface Props {
  /** Both crops of the shot, or null while nothing is captured. */
  image: CapturedFace | null;
  onImageChange: (image: CapturedFace | null) => void;
}

/** Face registration: live capture is the main (always active) way; a photo from the device is the alternative. */
export function FaceEnrollment({ image, onImageChange }: Props) {
  const [cameraKey, setCameraKey] = useState(0);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  /** A photo from the device goes through the same face detection and crops as a live capture. */
  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setReading(true);
    try {
      const { detectFaceCropsInImage } = await import("@/components/camera/faceCrop");
      const crops = await detectFaceCropsInImage(await fileToResizedDataUrl(file, 1280, "image/jpeg"));
      if (!crops) toast.error("No se detectó un rostro claro en esa foto. Prueba con otra o usa la cámara.");
      else onImageChange({ face: crops.face, carnet: crops.carnet });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="stack">
      {image && (
        <div className="stack" style={{ alignItems: "center" }}>
          {/* The looser crop is what's shown everywhere else, so it's what the organizer previews here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.carnet} alt="Foto capturada del jugador" className="avatar square" style={{ width: 240, height: 240 }} />
          <div className="row-wrap">
            <Button
              variant="secondary"
              icon={<RefreshCw size={18} />}
              onClick={() => {
                onImageChange(null);
                setCameraKey((key) => key + 1);
              }}
            >
              Repetir foto
            </Button>
          </div>
        </div>
      )}

      {!image && (
        <>
          <FaceCapture key={cameraKey} onCapture={(face, carnet) => onImageChange({ face, carnet })} buttonLabel="Capturar foto" />
          <div className="stack-sm" style={{ alignItems: "center" }}>
            <span className="text-secondary text-small">¿Ya tienes una foto del jugador?</span>
            <Button variant="secondary" icon={<ImageUp size={18} />} loading={reading} onClick={() => inputRef.current?.click()}>Subir foto desde el dispositivo</Button>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={pickFile} />
          </div>
          <ul className="stack-sm text-secondary" style={{ listStyle: "none" }}>
            {PHOTO_TIPS.map((tip) => (
              <li key={tip} className="row"><Check size={16} color="var(--color-success)" aria-hidden /> {tip}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

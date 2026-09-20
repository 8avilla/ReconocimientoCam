"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, RefreshCw } from "lucide-react";
import { Button, Loading } from "@/components/ui";

// MediaPipe (WASM) only runs in the browser.
const FaceCapture = dynamic(() => import("@/components/camera/FaceCapture"), { ssr: false, loading: () => <Loading /> });

const PHOTO_TIPS = ["Buena iluminación", "Rostro descubierto", "Sin gafas ni gorra", "Una sola persona"];

interface Props {
  /** Captured face crop (JPEG data URL), or null while nothing is captured. */
  image: string | null;
  consent: boolean;
  onConsentChange: (consent: boolean) => void;
  onImageChange: (image: string | null) => void;
}

/** Biometric consent + live face capture. The camera only starts after explicit consent. */
export function FaceEnrollment({ image, consent, onConsentChange, onImageChange }: Props) {
  const [cameraKey, setCameraKey] = useState(0);

  return (
    <div className="stack">
      <label className="checkbox-row">
        <input type="checkbox" checked={consent} onChange={(event) => onConsentChange(event.target.checked)} />
        <span>
          El jugador autoriza el uso de su fotografía y de sus datos biométricos faciales para verificar su identidad
          en los partidos de este campeonato.
        </span>
      </label>

      {consent && image && (
        <div className="stack" style={{ alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Foto capturada del jugador" className="avatar square" style={{ width: 240, height: 240 }} />
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

      {consent && !image && (
        <>
          <FaceCapture key={cameraKey} onCapture={onImageChange} buttonLabel="Capturar foto" />
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

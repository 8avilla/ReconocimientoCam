"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, RefreshCw } from "lucide-react";
import { Button, Loading } from "@/components/ui";

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
  consent: boolean;
  onConsentChange: (consent: boolean) => void;
  onImageChange: (image: CapturedFace | null) => void;
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

      {consent && !image && (
        <>
          <FaceCapture key={cameraKey} onCapture={(face, carnet) => onImageChange({ face, carnet })} buttonLabel="Capturar foto" />
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

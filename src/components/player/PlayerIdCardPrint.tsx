"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatDate, initials } from "@/lib/labels";
import type { PlayerCardDTO } from "@/types/api";
import styles from "./PlayerIdCardPrint.module.css";

/**
 * Landscape, printable version of the player's ID card. Stays off-screen (see .offscreen) until
 * "Imprimir carnet" calls `window.print()`; the ".print-target" rule in globals.css then hides
 * everything else on the page and shows only this card.
 */
export function PlayerIdCardPrint({ card }: { card: PlayerCardDTO }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(card.qrPayload, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setQr(url))
      .catch((error) => console.error("Failed to generate QR code:", error));
    return () => {
      cancelled = true;
    };
  }, [card.qrPayload]);

  return (
    <div className={`${styles.offscreen} print-target`}>
      <article className={styles.card} aria-label={`Carnet para imprimir de ${card.fullName}`}>
        <div className={styles.logos}>
          {card.championship?.logoUrl && <img src={card.championship.logoUrl} alt="" className={styles.logo} />}
          {card.team?.shieldUrl && <img src={card.team.shieldUrl} alt="" className={styles.logo} />}
        </div>
        {card.photoUrl ? (
          <img src={card.photoUrl} alt="" className={styles.photo} />
        ) : (
          <div className={styles.photoPlaceholder} aria-hidden>{initials(card.fullName)}</div>
        )}
        <div className={styles.info}>
          {card.championship && <div className={styles.championship}>{card.championship.name} · {card.championship.season}</div>}
          <div className={styles.name}>{card.fullName}</div>
          {card.team && <div className={styles.team}>{card.team.name}{card.shirtNumber != null && ` · #${card.shirtNumber}`}</div>}
          <div className={styles.field}><span>Documento</span>{card.documentId || "—"}</div>
          <div className={styles.field}><span>Nacimiento</span>{formatDate(card.birthDate)}</div>
          <div className={styles.field}><span>Código</span>{card.publicId}</div>
        </div>
        {qr && <img src={qr} alt="Código QR del jugador" className={styles.qr} />}
        <div className={styles.watermark}>Generado por SuperTorneos</div>
      </article>
    </div>
  );
}

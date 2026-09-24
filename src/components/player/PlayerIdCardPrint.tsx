"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import QRCode from "qrcode";
import { initials } from "@/lib/labels";
import type { PlayerCardDTO } from "@/types/api";
import styles from "./PlayerIdCardPrint.module.css";

/**
 * Landscape, printable version of the player's ID card. Stays off-screen (see .offscreen) until
 * "Imprimir carnet" calls `window.print()`; the ".print-target" rule in globals.css then hides
 * everything else on the page and shows only this card. "Descargar carnet" instead renders this
 * same element to a PNG (see downloadCarnet in the player page).
 *
 * No document id or birth date on this card by design: it's meant to be printed or shared as an
 * image, and those fields stay restricted to organizers inside the app.
 */
export function PlayerIdCardPrint({ card }: { card: PlayerCardDTO }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(card.qrPayload, { margin: 1, width: 240, errorCorrectionLevel: "M", color: { dark: "#0f172a" } })
      .then((url) => !cancelled && setQr(url))
      .catch((error) => console.error("Failed to generate QR code:", error));
    return () => {
      cancelled = true;
    };
  }, [card.qrPayload]);

  return (
    <div className={`${styles.offscreen} print-target`}>
      <article className={styles.card} aria-label={`Carnet para imprimir de ${card.fullName}`}>
        <img src="/brand-wordmark.png" alt="Super Torneos" className={styles.brand} />

        {card.championship && (
          <div className={styles.champBadge}>
            {card.championship.logoUrl ? (
              <span className={styles.champLogo} aria-hidden data-carnet-w="30" data-carnet-h="30" style={{ backgroundImage: `url("${card.championship.logoUrl}")` }} />
            ) : (
              <span className={styles.champLogoFallback} aria-hidden><Trophy size={16} /></span>
            )}
            <div className={styles.champText}>
              <span className={styles.champName}>{card.championship.name}</span>
              <span className={styles.champSeason}>{card.championship.season}</span>
            </div>
          </div>
        )}

        {card.photoUrl ? (
          // A background image (not <img>+object-fit) survives the html2canvas export used by
          // "Descargar carnet": html2canvas stretches <img> content to its box regardless of
          // object-fit, distorting any photo whose aspect ratio doesn't match the frame.
          <span className={styles.photo} aria-hidden data-carnet-w="130" data-carnet-h="170" style={{ backgroundImage: `url("${card.photoUrl}")` }} />
        ) : (
          <div className={styles.photoPlaceholder} aria-hidden>{initials(card.fullName)}</div>
        )}

        <div className={styles.info}>
          <div className={styles.name}>{card.fullName}</div>
          {card.team && (
            <div className={styles.team}>
              <span className={styles.teamLogo} aria-hidden data-carnet-w="24" data-carnet-h="24" style={{ backgroundImage: `url("${card.team.shieldUrl}")` }} />
              <div>
                <div className={styles.teamName}>{card.team.name}</div>
                {card.championship && <div className={styles.champLine}>{card.championship.name} {card.championship.season}</div>}
              </div>
            </div>
          )}
          {(card.shirtNumber !== null || card.position !== null) && (
            <div className={styles.numberRow}>
              {card.shirtNumber !== null && (
                <>
                  <span className={styles.numberBar} aria-hidden />
                  <span className={styles.number}>#{card.shirtNumber}</span>
                </>
              )}
              {card.shirtNumber !== null && card.position !== null && <span className={styles.sep}>|</span>}
              {card.position !== null && <span className={styles.position}>{card.position}</span>}
            </div>
          )}
        </div>

        <div className={styles.side}>
          {qr && <img src={qr} alt="Código QR del jugador" className={styles.qr} />}
          <div className={styles.id}>ID: {card.publicId}</div>
        </div>
      </article>
    </div>
  );
}

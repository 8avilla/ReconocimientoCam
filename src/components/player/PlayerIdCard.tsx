"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Avatar } from "@/components/ui";
import { RegistrationBadge } from "./PlayerBadges";
import type { PlayerCardDTO } from "@/types/api";
import styles from "./PlayerIdCard.module.css";

/** Digital ID card. The QR encodes only the opaque public id, never personal data. */
export function PlayerIdCard({ card }: { card: PlayerCardDTO }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(card.qrPayload, { margin: 1, width: 336, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setQr(url))
      .catch((error) => console.error("Failed to generate QR code:", error));
    return () => {
      cancelled = true;
    };
  }, [card.qrPayload]);

  return (
    <article className={styles.card} aria-label={`Carnet de ${card.fullName}`}>
      <header className={styles.header}>
        <div className={styles.championship}>{card.championship?.name ?? "Super Torneos"}</div>
        {card.championship && <div className={styles.season}>Temporada {card.championship.season}</div>}
      </header>
      <div className={styles.body}>
        <Avatar src={card.photoUrl} name={card.fullName} size={140} square />
        <h2 className={styles.name}>{card.fullName}</h2>
        {card.team && (
          <div className={styles.team}>
            <Avatar src={card.team.shieldUrl} name={card.team.name} size={24} square />
            {card.team.name}
          </div>
        )}
        {(card.shirtNumber !== null || card.position !== null) && (
          <div>
            {card.shirtNumber !== null && <div className={styles.number}>#{card.shirtNumber}</div>}
            {card.position !== null && <div className="text-secondary">{card.position}</div>}
          </div>
        )}
        {qr ? (
          <img src={qr} alt="Código QR del jugador" className={styles.qr} />
        ) : (
          <div className={styles.qrPlaceholder} aria-hidden />
        )}
        <RegistrationBadge status={card.status} />
        <div className={styles.id}>ID: {card.publicId}</div>
      </div>
    </article>
  );
}

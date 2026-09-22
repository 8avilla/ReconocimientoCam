"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Copy, Share2 } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { championshipPath, type Section } from "@/lib/paths";

const SHARED: { label: string; section?: Section }[] = [
  { label: "Resumen del campeonato" },
  { label: "Partidos", section: "partidos" },
  { label: "Clasificación y estadísticas", section: "clasificacion" },
  { label: "Equipos", section: "equipos" },
];

/** The link visitors use to follow the championship, with copy, share and a QR code for posters and groups. */
export function ShareLink({ championshipId, name }: { championshipId: string; name: string }) {
  const toast = useToast();
  // The address the app is served from (empty while rendering on the server).
  const origin = useSyncExternalStore(() => () => undefined, () => window.location.origin, () => "");
  const [qr, setQr] = useState("");
  const link = origin ? `${origin}${championshipPath(championshipId)}` : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar; selecciónalo y cópialo a mano");
    }
  }

  return (
    <div className="stack">
      <section className="card stack" aria-label="Enlace del campeonato">
        <h3>Enlace para seguir el campeonato</h3>
        <p className="text-secondary text-small">Compártelo por WhatsApp o redes: quien lo abra ve los partidos, resultados y tablas, y puede seguirlo con la estrella. No necesita cuenta.</p>
        <input className="input" readOnly value={link} aria-label="Enlace del campeonato" onFocus={(e) => e.currentTarget.select()} />
        <div className="row-wrap">
          <Button icon={<Copy size={18} />} onClick={() => void copy(link)} disabled={!link}>Copiar enlace</Button>
          {canShare && (
            <Button variant="secondary" icon={<Share2 size={18} />} disabled={!link} onClick={() => void navigator.share({ title: name, text: `Sigue ${name}`, url: link }).catch(() => undefined)}>
              Compartir
            </Button>
          )}
        </div>
        {qr && (
          <div className="stack-sm" style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`Código QR del enlace de ${name}`} width={200} height={200} style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }} />
            <a href={qr} download={`qr-${name}.png`} className="text-small" style={{ color: "var(--color-primary)" }}>Descargar QR</a>
          </div>
        )}
      </section>

      <section className="flush-list" aria-label="Enlaces por sección">
        <h2 className="band band-muted band-small">Enlaces directos</h2>
        {SHARED.map((item) => {
          const url = origin ? `${origin}${championshipPath(championshipId, item.section)}` : "";
          return (
            <div key={item.label} className="list-row row-between">
              <span className="text-strong">{item.label}</span>
              <Button variant="ghost" size="small" icon={<Copy size={16} />} disabled={!url} onClick={() => void copy(url)}>Copiar</Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

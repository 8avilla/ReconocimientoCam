"use client";

import { useState } from "react";
import { CloudDownload } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { http } from "@/lib/client/http";
import { useOnline } from "@/lib/client/useOutbox";
import type { MatchDTO } from "@/types/api";

const savedKey = (matchId: string) => `super-torneos:offline-saved:${matchId}`;

function readSavedAt(matchId: string): string | null {
  try {
    return window.localStorage.getItem(savedKey(matchId));
  } catch {
    return null;
  }
}

/**
 * Before going to a field with no signal: loads everything the match screen needs so the service worker keeps it
 * (the screen itself and its data). Opening the match with a connection already does it; this makes it explicit.
 */
export function OfflineSaveButton({ match }: { match: MatchDTO }) {
  const matchId = match._id;
  const championshipId = match.championshipId;
  const toast = useToast();
  const online = useOnline();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(() => readSavedAt(matchId));

  async function save() {
    setSaving(true);
    try {
      // On the very first visit the app's own files were loaded before the service worker took control, so they
      // were not kept: ask for them again (it answers and stores them) together with the screen and its data.
      if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
      const assets = [
        ...new Set(
          performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => new URL(url).origin === location.origin && (url.includes("/_next/static/") || url.includes("/_next/image")))
        ),
      ];
      await Promise.all(assets.map((url) => fetch(url).catch(() => undefined)));
      // Same addresses the match screen asks for, so the saved copy is the one it will look for offline.
      await Promise.all([
        fetch(`/matches/${matchId}`, { headers: { Accept: "text/html" } }),
        http("/auth/session"),
        http(`/matches/${matchId}`),
        http(`/matches/${matchId}/events`),
        http(`/matches/${matchId}/attendance`),
        http(`/suspensions?matchId=${matchId}&limit=50`),
        http(`/championships/${championshipId}`),
        http(`/championships/${championshipId}/phases`),
        http("/championships?limit=100"),
        ...(match.phaseId.type !== "knockout" ? [http(`/phases/${match.phaseId._id}/standings`)] : []),
        http(`/matches?championshipId=${championshipId}&teamId=${match.homeTeamId._id}&played=true&order=date&limit=50`),
      ]);
      const now = new Date().toISOString();
      try {
        window.localStorage.setItem(savedKey(matchId), now);
      } catch {
        // Storage blocked: the data is saved anyway, only the "saved at" note is lost.
      }
      setSavedAt(now);
      toast.success("Partido guardado: puedes abrirlo y marcar asistencia sin conexión");
    } catch {
      toast.error("No se pudo guardar el partido. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: "var(--space-lg)" }}>
      <Button variant="secondary" icon={<CloudDownload size={18} />} loading={saving} disabled={!online} onClick={save}>
        Guardar para usar sin conexión
      </Button>
      <p className="text-secondary text-small" style={{ marginTop: "var(--space-xs)" }}>
        {savedAt
          ? `Guardado el ${new Date(savedAt).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Sin conexión puedes marcar asistencia a mano; la cámara necesita internet.`
          : "Hazlo con conexión antes de ir a la cancha. Sin conexión puedes marcar asistencia a mano; la cámara necesita internet."}
      </p>
    </div>
  );
}

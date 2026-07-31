"use client";

import { useState } from "react";
import FaceCapture, { Coords } from "@/components/camera/FaceCapture";

type MatchResult = {
  match: string | null;
  confidence: number | null;
  location: { lat: number; lng: number; accuracy: number } | null;
  timestamp: string;
};

export default function CheckinPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState("");

  async function handleCapture(imageBase64: string, coords: Coords | null) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          lat: coords?.lat,
          lng: coords?.lng,
          accuracy: coords?.accuracy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar la marcación");
        return;
      }
      setResult(data);
    } catch (e) {
      setError("Error: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <h1>Marcar asistencia (prueba)</h1>
      <FaceCapture onCapture={handleCapture} busy={busy} buttonLabel="Marcar asistencia" />
      {error && <p style={{ color: "red" }}>{error}</p>}
      {result && (
        <div style={{ textAlign: "center" }}>
          {result.match ? (
            <p style={{ color: "#16a34a", fontSize: 20 }}>
              ✅ {result.match} — confianza {result.confidence?.toFixed(3)}
            </p>
          ) : (
            <p style={{ color: "#dc2626", fontSize: 20 }}>
              ❌ No se encontró coincidencia (mejor score: {result.confidence?.toFixed(3) ?? "N/A"})
            </p>
          )}
          {result.location && (
            <p>
              📍 {result.location.lat.toFixed(6)}, {result.location.lng.toFixed(6)} (±{Math.round(result.location.accuracy)}m)
            </p>
          )}
        </div>
      )}
    </main>
  );
}

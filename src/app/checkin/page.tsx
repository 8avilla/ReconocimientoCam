"use client";

import { useState } from "react";
import FaceCapture, { Coords } from "@/components/camera/FaceCapture";
import BackHomeButton from "@/components/BackHomeButton";

type MatchResult = {
  match: string | null;
  type: "checkin" | "checkout" | null;
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
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6f8",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <BackHomeButton />
      </div>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "#16a34a", margin: 0, fontSize: 28 }}>📸 Marcar asistencia</h1>
        <p style={{ color: "#6b7280", marginTop: 4 }}>Detecta tu rostro y captura para registrar entrada/salida</p>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <FaceCapture onCapture={handleCapture} busy={busy} buttonLabel="Marcar asistencia" />

        {error && (
          <div
            style={{
              width: "100%",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              borderRadius: 12,
              padding: "12px 16px",
              textAlign: "center",
            }}
          >
            ❌ {error}
          </div>
        )}

        {result && (
          <div
            style={{
              width: "100%",
              background: result.match ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${result.match ? "#bbf7d0" : "#fecaca"}`,
              borderRadius: 12,
              padding: "16px 20px",
              textAlign: "center",
            }}
          >
            {result.match ? (
              <p style={{ color: "#16a34a", fontSize: 18, fontWeight: 700, margin: 0 }}>
                ✅ {result.type === "checkout" ? "Salida" : "Entrada"} registrada — {result.match}
              </p>
            ) : (
              <p style={{ color: "#dc2626", fontSize: 18, fontWeight: 700, margin: 0 }}>
                ❌ No se encontró coincidencia
              </p>
            )}
            {result.match && (
              <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
                Confianza: {result.confidence?.toFixed(3)}
              </p>
            )}
            <p style={{ color: "#374151", fontSize: 14, margin: "8px 0 0" }}>
              🕒{" "}
              {new Date(result.timestamp).toLocaleString("es-CO", {
                dateStyle: "long",
                timeStyle: "medium",
              })}
            </p>
            {result.location && (
              <p style={{ color: "#374151", fontSize: 14, margin: "4px 0 0" }}>
                📍 {result.location.lat.toFixed(6)}, {result.location.lng.toFixed(6)} (±
                {Math.round(result.location.accuracy)}m)
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

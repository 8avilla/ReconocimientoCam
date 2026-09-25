"use client";

import { useState } from "react";
import { ScanFace } from "lucide-react";
import { Button, ErrorState, Input, Loading, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { SystemSettingsDTO } from "@/types/api";

/** App-wide configuration that applies the same to every championship — currently just the face-verification thresholds used during attendance at every match. */
export function SystemSettingsManager() {
  const { data, error, loading, reload } = useFetch<SystemSettingsDTO>("/system-settings");
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  return <SettingsForm data={data} onSaved={reload} />;
}

function SettingsForm({ data, onSaved }: { data: SystemSettingsDTO; onSaved: () => void }) {
  const toast = useToast();
  const [verifyThreshold, setVerifyThreshold] = useState(String(data.verifyThreshold));
  const [reviewThreshold, setReviewThreshold] = useState(String(data.reviewThreshold));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const verify = Number(verifyThreshold);
    const review = Number(reviewThreshold);
    if (review > verify) {
      setFormError("El umbral de revisión no puede superar el umbral de verificación");
      return;
    }
    setSaving(true);
    try {
      await http("/system-settings", { method: "PATCH", json: { verifyThreshold: verify, reviewThreshold: review } });
      toast.success("Configuración del sistema actualizada");
      onSaved();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <section className="card stack-sm" style={{ background: "var(--color-background)" }}>
        <div className="row-between">
          <h3>Precisión del reconocimiento facial (IA)</h3>
          <ScanFace size={20} style={{ color: "var(--color-primary)" }} />
        </div>
        <p className="text-secondary text-small">
          Umbral de coincidencia de la cámara al registrar asistencia en cancha. Se aplica igual a todos los campeonatos — no es una regla por campeonato.
        </p>
        {formError && <div className="alert error" role="alert">{formError}</div>}
        <div className="form-grid two">
          <div>
            <Input
              label="Umbral de verificación automática" type="number" step="0.01" min={0} max={1}
              hint="Valor recomendado: 0.35 (35%)." value={verifyThreshold} onChange={(e) => setVerifyThreshold(e.target.value)}
            />
            <div className="row-wrap" style={{ gap: 4, marginTop: 6 }}>
              <span className="text-small text-secondary">Presets:</span>
              <button type="button" className="preset-pill-btn" onClick={() => setVerifyThreshold("0.35")}>Estándar (35%)</button>
              <button type="button" className="preset-pill-btn" onClick={() => setVerifyThreshold("0.45")}>Estricto (45%)</button>
              <button type="button" className="preset-pill-btn" onClick={() => setVerifyThreshold("0.25")}>Permisivo (25%)</button>
            </div>
          </div>
          <Input
            label="Umbral de revisión manual" type="number" step="0.01" min={0} max={1}
            hint="Valor recomendado: 0.25 (25%)." value={reviewThreshold} onChange={(e) => setReviewThreshold(e.target.value)}
          />
        </div>
      </section>
      <div className="action-bar">
        <Button type="submit" loading={saving}>Guardar configuración</Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import type { PhaseDTO, PhaseHighlightsDTO } from "@/types/api";

interface Props {
  phase: PhaseDTO;
  onClose: () => void;
  onSaved: () => void;
}

type BandKey = "top1" | "top2" | "bottom1" | "bottom2";

const BANDS: { key: BandKey; label: string; color: string }[] = [
  { key: "top1", label: "Primeros (banda 1)", color: "var(--color-info)" },
  { key: "top2", label: "Primeros (banda 2)", color: "var(--color-primary)" },
  { key: "bottom1", label: "Últimos (banda 1)", color: "var(--color-warning)" },
  { key: "bottom2", label: "Últimos (banda 2)", color: "var(--color-error)" },
];

function toValues(phase: PhaseDTO): Record<BandKey, number> {
  const fallback: PhaseHighlightsDTO = phase.highlights ?? (phase.qualifyCount ? { top1: phase.qualifyCount } : {});
  return { top1: fallback.top1 ?? 0, top2: fallback.top2 ?? 0, bottom1: fallback.bottom1 ?? 0, bottom2: fallback.bottom2 ?? 0 };
}

/** How many rows to accent from the top and from the bottom of the standings table — two bands each
 * side, each its own color, moved with a slider. 0 (all the way left) turns a band off. */
export function PhaseHighlightsManager({ phase, onClose, onSaved }: Props) {
  const toast = useToast();
  const initial = toValues(phase);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  // A team count to cap the sliders at; falls back to a sane default while it's still loading elsewhere.
  const max = Math.max(phase.teamCount || 20, 1);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await http(`/phases/${phase._id}`, { method: "PATCH", json: { highlights: values } });
      toast.success("Resaltado de posiciones guardado");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const renderGroup = (title: string, keys: BandKey[]) => (
    <section className="stack-sm">
      <h3 style={{ fontSize: 15 }}>{title}</h3>
      {keys.map((key) => {
        const band = BANDS.find((item) => item.key === key)!;
        const value = values[key];
        return (
          <div key={key} className="row" style={{ gap: "var(--space-md)" }}>
            <input
              type="range"
              min={0}
              max={max}
              value={value}
              onChange={(event) => setValues((current) => ({ ...current, [key]: Number(event.target.value) }))}
              aria-label={band.label}
              style={{ accentColor: band.color, flex: 1 }}
            />
            <span
              className="text-strong text-small"
              style={{ width: 76, textAlign: "right", color: value > 0 ? band.color : "var(--color-text-disabled)" }}
            >
              {value > 0 ? `Top ${value}` : "Desactivado"}
            </span>
            <span aria-hidden style={{ width: 16, height: 16, borderRadius: "50%", background: band.color, flexShrink: 0 }} />
          </div>
        );
      })}
    </section>
  );

  return (
    <div className="stack">
      <p className="text-secondary">
        Colorea las primeras y las últimas posiciones de la tabla — por ejemplo, azul para quien clasifica directo, verde para repechaje, naranja para zona de riesgo y rojo para descenso.
      </p>
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}

      {renderGroup("Resaltar primeros", ["top1", "top2"])}
      {renderGroup("Resaltar últimos", ["bottom1", "bottom2"])}

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button>
        <Button loading={saving} disabled={!dirty} onClick={save}>Guardar</Button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { Button, Input, useToast } from "@/components/ui";
import type { TiebreakCriterion } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { TIEBREAK_CRITERION_LABEL } from "@/lib/labels";
import { inactiveTiebreakers, resolveTiebreakers } from "@/lib/rules/tiebreakers";
import type { ChampionshipDTO, PhaseDTO } from "@/types/api";

interface Props {
  phase: PhaseDTO;
  onClose: () => void;
  onSaved: () => void;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Which tiebreak criteria a phase uses and in which order. The system offers every criterion; the organizer turns each
 * one on or off and orders the ones that are on. Ties in points are broken by the active ones, top to bottom, and then by
 * team name. A saved choice applies from then on; it never rewrites past standings, since the table is recomputed live
 * from the match results every time it's viewed.
 *
 * "Juego limpio" counts the cards a team has in the whole championship, weighted by points per yellow and per red
 * (editable here; they belong to the championship, so they apply to every phase that uses the criterion).
 *
 * The drag itself is done with Pointer Events (not native HTML5 drag-and-drop): native DnD barely works
 * on touch devices, and this app is mobile-first. Only the grip handle starts a drag — that pointer
 * captures for the whole gesture, so the row can be reordered by dragging up or down anywhere on
 * screen, and the up/down buttons never accidentally start one. */
export function PhaseTiebreakersManager({ phase, onClose, onSaved }: Props) {
  const toast = useToast();
  const { reload: reloadChampionship } = useChampionship();
  const championship = useFetch<ChampionshipDTO>(`/championships/${phase.championshipId}`);
  const initial = resolveTiebreakers(phase);
  const [order, setOrder] = useState<TiebreakCriterion[]>(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [weightErrors, setWeightErrors] = useState<Record<string, string>>({});
  // Points per card for "juego limpio" (null until the championship's own values arrive: then they are the starting point).
  const [weightEdits, setWeightEdits] = useState<{ yellow: string; red: string } | null>(null);
  const savedWeights = { yellow: String(championship.data?.rules.fairPlayYellowPoints ?? 1), red: String(championship.data?.rules.fairPlayRedPoints ?? 2) };
  const weights = weightEdits ?? savedWeights;
  const weightsDirty = weights.yellow !== savedWeights.yellow || weights.red !== savedWeights.red;
  const dirty = JSON.stringify(order) !== JSON.stringify(initial) || (order.includes("fair_play") && weightsDirty);
  const inactive = inactiveTiebreakers(order);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  function targetIndexFor(clientY: number) {
    let index = 0;
    for (const row of rowRefs.current) {
      const rect = row?.getBoundingClientRect();
      if (rect && clientY > rect.top + rect.height / 2) index += 1;
    }
    return Math.min(index, order.length - 1);
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragIndex(index);
  }

  function dragMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragIndex === null) return;
    const next = targetIndexFor(event.clientY);
    if (next !== dragIndex) {
      setOrder((current) => move(current, dragIndex, next));
      setDragIndex(next);
    }
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragIndex(null);
  }

  async function save() {
    setSaving(true);
    setError("");
    setWeightErrors({});
    try {
      if (order.includes("fair_play") && weightsDirty) {
        const yellow = Number(weights.yellow);
        const red = Number(weights.red);
        const invalid = (value: number) => !Number.isInteger(value) || value < 0 || value > 100;
        if (invalid(yellow) || invalid(red)) {
          setWeightErrors({ ...(invalid(yellow) ? { yellow: "Un número entero de 0 a 100" } : {}), ...(invalid(red) ? { red: "Un número entero de 0 a 100" } : {}) });
          return;
        }
        await http(`/championships/${phase.championshipId}`, { method: "PATCH", json: { rules: { fairPlayYellowPoints: yellow, fairPlayRedPoints: red } } });
        reloadChampionship();
      }
      await http(`/phases/${phase._id}`, { method: "PATCH", json: { tiebreakers: order } });
      toast.success("Criterios de clasificación guardados");
      onSaved();
    } catch (err) {
      setError(err instanceof HttpError && Object.keys(err.fieldErrors).length > 0 ? Object.values(err.fieldErrors)[0] : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <p className="text-secondary">
        Cuando dos equipos quedan empatados en puntos, se desempatan con los criterios activos, en este orden. Activa o desactiva
        cada uno con su interruptor y ordena los activos arrastrando desde{" "}
        <GripVertical size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> (o con las flechas).
      </p>
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}

      <section aria-label="Criterios activos" className="stack-sm">
        <h3 style={{ fontSize: 15 }}>Activos ({order.length})</h3>
        {order.length === 0 ? (
          <div className="card text-secondary">Ninguno activo: los empates en puntos quedan en orden alfabético por nombre del equipo.</div>
        ) : (
          <ol className="card flush" style={{ listStyle: "none" }}>
            {order.map((criterion, index) => {
              const info = TIEBREAK_CRITERION_LABEL[criterion];
              const dragging = dragIndex === index;
              return (
                <li
                  key={criterion}
                  ref={(el) => { rowRefs.current[index] = el; }}
                  className="list-row"
                  style={{
                    background: dragging ? "var(--color-background)" : undefined,
                    boxShadow: dragging ? "var(--shadow-lg)" : undefined,
                    position: "relative",
                    zIndex: dragging ? 1 : undefined,
                    transition: "background 0.1s ease",
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Arrastrar para reordenar ${info.label}`}
                    className="icon-button"
                    style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none", flexShrink: 0 }}
                    onPointerDown={(event) => startDrag(event, index)}
                    onPointerMove={dragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <GripVertical size={18} aria-hidden />
                  </button>
                  <span className="text-secondary" style={{ width: 20, flexShrink: 0 }}>{index + 1}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="text-strong">{info.label}</div>
                    <div className="text-secondary text-small">{info.description}</div>
                  </div>
                  <div className="stack-sm" style={{ gap: 2, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="icon-button"
                      style={{ width: 28, height: 28 }}
                      disabled={index === 0}
                      aria-label={`Subir ${info.label}`}
                      onClick={() => setOrder((current) => move(current, index, index - 1))}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      style={{ width: 28, height: 28 }}
                      disabled={index === order.length - 1}
                      aria-label={`Bajar ${info.label}`}
                      onClick={() => setOrder((current) => move(current, index, index + 1))}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <Switch label={`Usar ${info.label}`} checked onChange={() => setOrder((current) => current.filter((item) => item !== criterion))} />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {order.includes("fair_play") && (
        <section aria-label="Puntos de juego limpio" className="card stack-sm">
          <h3 style={{ fontSize: 15 }}>Puntos de juego limpio</h3>
          <p className="text-secondary text-small">
            Cada tarjeta suma estos puntos al equipo en todo el torneo; con menos puntos queda arriba. Una doble amarilla cuenta como una
            amarilla y una roja. Se aplican a todas las fases del torneo que usen este criterio.
          </p>
          <div className="row" style={{ gap: "var(--space-md)", alignItems: "flex-start" }}>
            <div className="grow">
              <Input
                label="Por tarjeta amarilla"
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={weights.yellow}
                error={weightErrors.yellow}
                onChange={(event) => setWeightEdits({ ...weights, yellow: event.target.value })}
              />
            </div>
            <div className="grow">
              <Input
                label="Por tarjeta roja"
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={weights.red}
                error={weightErrors.red}
                onChange={(event) => setWeightEdits({ ...weights, red: event.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section aria-label="Criterios inactivos" className="stack-sm">
          <h3 style={{ fontSize: 15 }}>Disponibles, sin usar ({inactive.length})</h3>
          <ul className="card flush" style={{ listStyle: "none" }}>
            {inactive.map((criterion) => {
              const info = TIEBREAK_CRITERION_LABEL[criterion];
              return (
                <li key={criterion} className="list-row">
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="text-strong">{info.label}</div>
                    <div className="text-secondary text-small">{info.description}</div>
                  </div>
                  <Switch label={`Usar ${info.label}`} checked={false} onChange={() => setOrder((current) => [...current, criterion])} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button>
        <Button loading={saving} disabled={!dirty} onClick={save}>Guardar criterios</Button>
      </div>
    </div>
  );
}

/** On/off switch (a button with the `switch` role, so it works with keyboard and screen readers). The button is 44 px tall to be easy to tap; the track inside is what is drawn. */
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={{ flexShrink: 0, width: 56, height: 44, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <span
        aria-hidden
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          padding: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: checked ? "flex-end" : "flex-start",
          background: checked ? "var(--color-primary)" : "var(--color-border-input)",
          transition: "background 0.15s ease",
        }}
      >
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
      </span>
    </button>
  );
}

"use client";

import { useRef, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { TIEBREAK_CRITERIA, type TiebreakCriterion } from "@/lib/constants";
import { errorMessage, http } from "@/lib/client/http";
import { TIEBREAK_CRITERION_LABEL } from "@/lib/labels";
import type { PhaseDTO } from "@/types/api";

interface Props {
  phase: PhaseDTO;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_ORDER: TiebreakCriterion[] = ["head_to_head", "goal_difference", "goals_for", "most_wins", "fewest_goals_against"];

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Order in which ties are broken after points — a drag-to-reorder list (also usable with the up/down
 * buttons, for keyboard access). Saved order applies from then on; it never rewrites past standings,
 * since the table is recomputed live from the match results every time it's viewed.
 *
 * The drag itself is done with Pointer Events (not native HTML5 drag-and-drop): native DnD barely works
 * on touch devices, and this app is mobile-first. Only the grip handle starts a drag — that pointer
 * captures for the whole gesture, so the row can be reordered by dragging up or down anywhere on
 * screen, and the up/down buttons never accidentally start one. */
export function PhaseTiebreakersManager({ phase, onClose, onSaved }: Props) {
  const toast = useToast();
  const initial = phase.tiebreakers?.length ? phase.tiebreakers : DEFAULT_ORDER;
  const [order, setOrder] = useState<TiebreakCriterion[]>(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(order) !== JSON.stringify(initial);
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
    try {
      await http(`/phases/${phase._id}`, { method: "PATCH", json: { tiebreakers: order } });
      toast.success("Criterio de clasificación guardado");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <p className="text-secondary">
        Cuando dos equipos quedan empatados en puntos, se desempatan en este orden. Arrastra desde{" "}
        <GripVertical size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> para reordenar (o usa las flechas).
      </p>
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}

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
            </li>
          );
        })}
      </ol>

      {order.length !== TIEBREAK_CRITERIA.length && (
        <p className="text-secondary text-small">Faltan criterios en la lista; recárgala si esto no debería pasar.</p>
      )}

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cerrar</Button>
        <Button loading={saving} disabled={!dirty} onClick={save}>Guardar orden</Button>
      </div>
    </div>
  );
}

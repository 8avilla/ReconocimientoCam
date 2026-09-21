"use client";

import { useState } from "react";
import { AlertCircle, CalendarClock, Eraser, Wand2 } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, Input, Loading, Modal, useToast } from "@/components/ui";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/client/datetime";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO, Paginated } from "@/types/api";

interface Props {
  open: boolean;
  matchday: { _id: string; name: string };
  onClose: () => void;
  onSaved: () => void;
}

export function MatchdayScheduleModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={`Programar · ${props.matchday.name}`} onClose={props.onClose} wide>
      <Schedule {...props} />
    </Modal>
  );
}

interface Row {
  when: string; // datetime-local, "" = no day/time
  venue: string;
}

/** Loads the matches of the matchday and mounts the editor with them. */
function Schedule({ matchday, onClose, onSaved }: Omit<Props, "open">) {
  const list = useFetch<Paginated<MatchDTO>>(`/matches?matchdayId=${matchday._id}&limit=100`);
  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!list.data) return <Loading />;
  return <ScheduleEditor matchday={matchday} matches={list.data.data} onClose={onClose} onSaved={onSaved} />;
}

function ScheduleEditor({ matchday, matches, onClose, onSaved }: { matchday: Props["matchday"]; matches: MatchDTO[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const initial = Object.fromEntries(matches.map((match): [string, Row] => [match._id, { when: toDateTimeLocal(match.scheduledAt ?? undefined), venue: match.venue }]));
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  const [day, setDay] = useState("");
  const [times, setTimes] = useState("");
  const [venue, setVenue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editable = matches.filter((match) => match.status !== "live" && match.status !== "finished");
  const changed = editable.filter((match) => rows[match._id].when !== initial[match._id].when || rows[match._id].venue !== initial[match._id].venue);
  const setRow = (id: string, patch: Partial<Row>) => setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  /** Optional helper: puts the given times, in order, on the chosen day. The organizer reviews and saves. */
  function assignInOrder() {
    const slots = times.split(",").map((time) => time.trim()).filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
    if (!day || slots.length === 0) {
      setNote("Indica el día y al menos un horario con formato HH:mm, por ejemplo 19:00, 21:00.");
      return;
    }
    setRows((current) => {
      const next = { ...current };
      editable.forEach((match, index) => {
        if (index < slots.length) next[match._id] = { when: `${day}T${slots[index]}`, venue: venue.trim() || next[match._id].venue };
      });
      return next;
    });
    setNote(editable.length > slots.length ? `Hay ${editable.length} partidos y ${slots.length} horarios: los ${editable.length - slots.length} restantes quedan sin cambios.` : "");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await http(`/matchdays/${matchday._id}/schedule`, {
        method: "PUT",
        json: { matches: changed.map((match) => ({ matchId: match._id, scheduledAt: rows[match._id].when ? fromDateTimeLocal(rows[match._id].when) : null, venue: rows[match._id].venue.trim() })) },
      });
      toast.success("Programación guardada");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (matches.length === 0) {
    return (
      <div className="stack">
        <EmptyState icon={<CalendarClock size={28} />} title="Esta fecha aún no tiene partidos" description="Genera los partidos de la fase o agrégalos a mano." />
        <div className="action-bar"><Button variant="secondary" onClick={onClose}>Cerrar</Button></div>
      </div>
    );
  }

  return (
    <div className="stack">
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      <p className="text-secondary">Asigna el día, la hora y la cancha de cada partido. Puedes dejar campos vacíos y cambiarlos cuando quieras.</p>

      <details className="card">
        <summary className="text-strong" style={{ cursor: "pointer", minHeight: 32 }}><Wand2 size={16} aria-hidden style={{ verticalAlign: "-3px" }} /> Ayuda opcional: asignar horarios en orden</summary>
        <div className="stack" style={{ marginTop: "var(--space-md)" }}>
          <div className="form-grid two">
            <Input label="Día" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            <Input label="Horarios" value={times} onChange={(e) => setTimes(e.target.value)} hint="Separados por coma, uno por partido: 19:00, 21:00" />
          </div>
          <Input label="Cancha (opcional, para todos)" value={venue} onChange={(e) => setVenue(e.target.value)} />
          {note && <div className="alert info" role="note"><AlertCircle size={18} /> {note}</div>}
          <div className="row-wrap">
            <Button variant="secondary" size="small" onClick={assignInOrder}>Asignar en orden</Button>
            <Button variant="ghost" size="small" icon={<Eraser size={16} />} onClick={() => setRows((current) => Object.fromEntries(Object.entries(current).map(([id, row]) => [id, { ...row, when: matches.find((match) => match._id === id && (match.status === "live" || match.status === "finished")) ? row.when : "" }])))}>
              Quitar día y hora a todos
            </Button>
          </div>
        </div>
      </details>

      <div className="stack-sm">
        {matches.map((match) => {
          const locked = match.status === "live" || match.status === "finished";
          return (
            <div key={match._id} className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="grow" style={{ minWidth: 180 }}>
                <div className="text-strong truncate">{match.homeTeamId.name} vs {match.awayTeamId.name}</div>
                <div className="text-secondary text-small">{match.group ?? ""} {locked && <Badge tone="neutral">{MATCH_STATUS_LABEL[match.status].label}</Badge>}</div>
              </div>
              <div style={{ minWidth: 200 }}>
                <Input label="Día y hora" type="datetime-local" disabled={locked} value={rows[match._id].when} onChange={(e) => setRow(match._id, { when: e.target.value })} />
              </div>
              <div style={{ minWidth: 140 }}>
                <Input label="Cancha" disabled={locked} value={rows[match._id].venue} onChange={(e) => setRow(match._id, { venue: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button size="large" loading={saving} disabled={changed.length === 0} onClick={save}>Guardar programación{changed.length > 0 ? ` (${changed.length})` : ""}</Button>
      </div>
    </div>
  );
}

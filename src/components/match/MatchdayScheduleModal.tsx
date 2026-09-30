"use client";

import { useState } from "react";
import { AlertCircle, CalendarClock, Copy, Eraser, Plus, Wand2, X } from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Input, Loading, Modal, Select, useToast } from "@/components/ui";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/client/datetime";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO, Paginated, RefereeDTO, VenueDTO } from "@/types/api";

interface Props {
  open: boolean;
  matchday: { _id: string; name: string };
  /** The fechas to program after this one: "Guardar y seguir con …" walks through them without closing. */
  following?: { _id: string; name: string }[];
  onClose: () => void;
  /** Called when a fecha is saved and there is nothing more to program (closes the modal). */
  onSaved: () => void;
  /** Called after each fecha saved while moving on to the next one, so the lists behind refresh. */
  onProgress?: () => void;
}

export function MatchdayScheduleModal({ open, following = [], onProgress, ...props }: Props) {
  // The fecha on screen and the ones still to come; moving on swaps them and remounts the editor.
  const [active, setActive] = useState(props.matchday);
  const [queue, setQueue] = useState(following);
  return (
    <Modal open={open} title={`Programar · ${active.name}`} onClose={props.onClose} wide>
      <Schedule
        key={active._id}
        matchday={active}
        next={queue[0]}
        onClose={props.onClose}
        onSaved={props.onSaved}
        onAdvance={() => {
          onProgress?.();
          setActive(queue[0]);
          setQueue(queue.slice(1));
        }}
      />
    </Modal>
  );
}

interface Row {
  when: string; // datetime-local, "" = no day/time
  venue: string;
  /** "" = no referee. */
  refereeId: string;
}

/** Loads the matches of the matchday and mounts the editor with them. */
function Schedule({ matchday, next, onClose, onSaved, onAdvance }: { matchday: Props["matchday"]; next?: Props["matchday"]; onClose: () => void; onSaved: () => void; onAdvance: () => void }) {
  const list = useFetch<Paginated<MatchDTO>>(`/matches?matchdayId=${matchday._id}&limit=100`);
  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!list.data) return <Loading />;
  return <ScheduleEditor matchday={matchday} matches={list.data.data} next={next} onClose={onClose} onSaved={onSaved} onAdvance={onAdvance} />;
}

function ScheduleEditor({ matchday, matches, next, onClose, onSaved, onAdvance }: { matchday: Props["matchday"]; matches: MatchDTO[]; next?: Props["matchday"]; onClose: () => void; onSaved: () => void; onAdvance: () => void }) {
  const toast = useToast();
  const championshipId = matches[0]?.championshipId;
  const referees = useFetch<{ data: RefereeDTO[] }>(championshipId ? `/referees?championshipId=${championshipId}&active=true` : null);
  const venues = useFetch<{ data: VenueDTO[] }>(championshipId ? `/venues?championshipId=${championshipId}&active=true` : null);
  const initial = Object.fromEntries(matches.map((match): [string, Row] => [match._id, { when: toDateTimeLocal(match.scheduledAt ?? undefined), venue: match.venue, refereeId: match.refereeId?._id ?? "" }]));
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  // The day is picked once; each match then takes one of the usual kick-off times with a tap.
  const [day, setDay] = useState(() => matches.find((match) => match.scheduledAt)?.scheduledAt?.slice(0, 10) ?? "");
  const [slotsText, setSlotsText] = useStoredState<string>("super-torneos:schedule-slots", "17:00,19:00,21:00");
  const slots = [...new Set(slotsText.split(",").map((slot) => slot.trim()).filter((slot) => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot)))].sort();
  const [newSlot, setNewSlot] = useState("");
  const [venue, setVenue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editable = matches.filter((match) => match.status !== "live" && match.status !== "finished");
  const changed = editable.filter((match) => rows[match._id].when !== initial[match._id].when || rows[match._id].venue !== initial[match._id].venue || rows[match._id].refereeId !== initial[match._id].refereeId);
  const { requestClose, confirmProps } = useUnsavedGuard(changed.length > 0, onClose);
  const setRow = (id: string, patch: Partial<Row>) => setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  /** Puts one of the usual times on a match, on the day it already has or else the day chosen above. */
  function setTime(id: string, time: string) {
    const date = rows[id].when.slice(0, 10) || day;
    if (!date) {
      setNote("Elige primero el día de la fecha.");
      return;
    }
    setNote("");
    setRow(id, { when: `${date}T${time}` });
  }

  function addSlot() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newSlot)) return;
    setSlotsText([...slots, newSlot].join(","));
    setNewSlot("");
  }

  /** Optional helper: puts the usual times, in order, on the chosen day. The organizer reviews and saves. */
  function assignInOrder() {
    if (!day || slots.length === 0) {
      setNote("Elige el día y deja al menos un horario.");
      return;
    }
    setRows((current) => {
      const next = { ...current };
      editable.forEach((match, index) => {
        if (index < slots.length) next[match._id] = { ...next[match._id], when: `${day}T${slots[index]}`, venue: venue.trim() || next[match._id].venue };
      });
      return next;
    });
    setNote(editable.length > slots.length ? `Hay ${editable.length} partidos y ${slots.length} horarios: los ${editable.length - slots.length} restantes quedan sin cambios.` : "");
  }

  async function save(andNext = false) {
    // Nothing edited here: just move on to the next fecha.
    if (andNext && changed.length === 0) {
      onAdvance();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await http(`/matchdays/${matchday._id}/schedule`, {
        method: "PUT",
        json: { matches: changed.map((match) => ({ matchId: match._id, scheduledAt: rows[match._id].when ? fromDateTimeLocal(rows[match._id].when) : null, venue: rows[match._id].venue.trim(), refereeId: rows[match._id].refereeId || null })) },
      });
      toast.success("Programación guardada");
      if (andNext) onAdvance();
      else onSaved();
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

      {note && <div className="alert info" role="note"><AlertCircle size={18} /> {note}</div>}
      <div className="card stack">
        <div className="form-grid two">
          <Input label="Día de la fecha" type="date" value={day} onChange={(e) => setDay(e.target.value)} hint="Con el día elegido, toca un horario en cada partido." />
          <div className="field">
            <label htmlFor="new-slot">Horarios habituales</label>
            <div className="row" style={{ gap: "var(--space-sm)" }}>
              <input id="new-slot" className="input" type="time" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
              <Button variant="secondary" size="small" icon={<Plus size={16} />} disabled={!newSlot} onClick={addSlot}>Agregar</Button>
            </div>
          </div>
        </div>
        <div className="chips" aria-label="Horarios habituales">
          {slots.map((slot) => (
            <span key={slot} className="chip">
              {slot}
              <button type="button" aria-label={`Quitar el horario ${slot}`} onClick={() => setSlotsText(slots.filter((item) => item !== slot).join(","))}><X size={14} aria-hidden /></button>
            </span>
          ))}
          {slots.length === 0 && <span className="text-secondary text-small">Agrega los horarios en que sueles jugar.</span>}
        </div>
        <details>
          <summary className="text-strong" style={{ cursor: "pointer", minHeight: 32 }}><Wand2 size={16} aria-hidden style={{ verticalAlign: "-3px" }} /> Asignar horarios en orden (opcional)</summary>
          <div className="stack" style={{ marginTop: "var(--space-md)" }}>
            <p className="text-secondary text-small">Pone los horarios de arriba, en orden, a los partidos de esta fecha en el día elegido.</p>
            <Input label="Cancha (opcional, para todos)" list="schedule-venues" value={venue} onChange={(e) => setVenue(e.target.value)} />
            <div className="row-wrap">
              <Button variant="secondary" size="small" onClick={assignInOrder}>Asignar en orden</Button>
              <Button variant="ghost" size="small" icon={<Eraser size={16} />} onClick={() => setRows((current) => Object.fromEntries(Object.entries(current).map(([id, row]) => [id, { ...row, when: matches.find((match) => match._id === id && (match.status === "live" || match.status === "finished")) ? row.when : "" }])))}>
                Quitar día y hora a todos
              </Button>
            </div>
          </div>
        </details>
      </div>

      <datalist id="schedule-venues">
        {venues.data?.data.map((venueItem) => <option key={venueItem._id} value={venueItem.name} />)}
      </datalist>

      <div className="stack">
        {matches.map((match, index) => {
          const locked = match.status === "live" || match.status === "finished";
          const previousVenue = index > 0 ? rows[matches[index - 1]._id].venue : "";
          return (
            <div key={match._id} className="stack-sm">
              <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="grow" style={{ minWidth: 180 }}>
                  <div className="text-strong truncate">{match.homeTeamId.name} vs {match.awayTeamId.name}</div>
                  <div className="text-secondary text-small">{match.group ?? ""} {locked && <Badge tone="neutral">{MATCH_STATUS_LABEL[match.status].label}</Badge>}</div>
                </div>
                <div style={{ minWidth: 200 }}>
                  <Input label="Día y hora" type="datetime-local" disabled={locked} value={rows[match._id].when} onChange={(e) => setRow(match._id, { when: e.target.value })} />
                </div>
                <div style={{ minWidth: 140 }}>
                  <Input label="Cancha" list="schedule-venues" disabled={locked} value={rows[match._id].venue} onChange={(e) => setRow(match._id, { venue: e.target.value })} />
                </div>
                {(referees.data?.data.length ?? 0) > 0 && (
                  <div style={{ minWidth: 160 }}>
                    <Select label="Árbitro" disabled={locked} value={rows[match._id].refereeId} onChange={(e) => setRow(match._id, { refereeId: e.target.value })}>
                      <option value="">Sin árbitro</option>
                      {referees.data?.data.map((referee) => <option key={referee._id} value={referee._id}>{referee.fullName}</option>)}
                    </Select>
                  </div>
                )}
              </div>
              {!locked && (
                <div className="row-wrap" style={{ gap: "var(--space-xs)" }}>
                  {slots.map((slot) => (
                    <button key={slot} type="button" className={`filter-chip${rows[match._id].when.endsWith(`T${slot}`) ? " active" : ""}`} onClick={() => setTime(match._id, slot)}>{slot}</button>
                  ))}
                  {previousVenue && previousVenue !== rows[match._id].venue && (
                    <button type="button" className="filter-chip" onClick={() => setRow(match._id, { venue: previousVenue })}><Copy size={12} aria-hidden /> Cancha: {previousVenue}</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="action-bar">
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        {next && <Button variant="secondary" size="large" loading={saving} onClick={() => save(true)}>{changed.length > 0 ? "Guardar y seguir con" : "Seguir con"} {next.name}</Button>}
        <Button size="large" loading={saving} disabled={changed.length === 0} onClick={() => save()}>Guardar programación{changed.length > 0 ? ` (${changed.length})` : ""}</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </div>
  );
}

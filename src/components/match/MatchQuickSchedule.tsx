"use client";

import { useState } from "react";
import { AlertCircle, CalendarClock } from "lucide-react";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/client/datetime";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchDTO, VenueDTO } from "@/types/api";

/** Reschedule from the match's own header: day, time and venue in one small sheet, no need to open the full edit form. */
export function MatchQuickSchedule({ match, onChanged }: { match: MatchDTO; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="small" icon={<CalendarClock size={16} />} onClick={() => setOpen(true)}>
        {match.scheduledAt ? "Cambiar día, hora o cancha" : "Asignar día, hora y cancha"}
      </Button>
      <Modal open={open} title="Día, hora y cancha" onClose={() => setOpen(false)}>
        <ScheduleForm key={match._id} match={match} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} />
      </Modal>
    </>
  );
}

function ScheduleForm({ match, onClose, onSaved }: { match: MatchDTO; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const venues = useFetch<{ data: VenueDTO[] }>(`/venues?championshipId=${match.championshipId}&active=true`);
  const [when, setWhen] = useState(toDateTimeLocal(match.scheduledAt ?? undefined));
  const [venue, setVenue] = useState(match.venue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await http(`/matches/${match._id}`, { method: "PATCH", json: { scheduledAt: when ? fromDateTimeLocal(when) : null, venue: venue.trim() } });
      toast.success("Programación actualizada");
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="stack" noValidate>
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      <Input label="Día y hora" type="datetime-local" autoFocus value={when} onChange={(event) => setWhen(event.target.value)} hint="Déjalo vacío para quitar el día y la hora." />
      <Input label="Cancha" list="quick-venues" value={venue} onChange={(event) => setVenue(event.target.value)} hint={(venues.data?.data.length ?? 0) > 0 ? "Elige una de tus canchas o escribe otra." : undefined} />
      <datalist id="quick-venues">{venues.data?.data.map((item) => <option key={item._id} value={item.name} />)}</datalist>
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar</Button>
      </div>
    </form>
  );
}

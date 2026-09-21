"use client";

import React, { useState } from "react";
import { AlertCircle, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { MatchdayScheduleModal } from "@/components/match/MatchdayScheduleModal";
import { Badge, Button, EmptyState, ErrorState, Input, Loading, Modal, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { MatchdayDTO, PhaseDTO } from "@/types/api";
import { CalendarDays } from "lucide-react";

interface Props {
  open: boolean;
  phase: PhaseDTO;
  onClose: () => void;
  /** Called after any change so the caller can refresh its counts. */
  onChanged: () => void;
}

export function MatchdaysModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={`Fechas · ${props.phase.name}`} onClose={props.onClose} wide>
      <Matchdays {...props} />
    </Modal>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });

function Matchdays({ phase, onClose, onChanged }: Omit<Props, "open">) {
  const toast = useToast();
  const list = useFetch<{ data: MatchdayDTO[] }>(`/phases/${phase._id}/matchdays`);
  const [editing, setEditing] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<MatchdayDTO | null>(null);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isKnockout = phase.type === "knockout";

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      toast.success(success);
      setEditing(null);
      setNewName("");
      list.reload();
      onChanged();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  if (!list.data) return <Loading />;
  const matchdays = list.data.data;

  return (
    <div className="stack">
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      <p className="text-secondary">
        Cada partido se juega en una fecha de la fase. {isKnockout ? "En una eliminatoria las fechas se crean solas al programar los partidos de cada ronda." : "Créalas a mano o deja que el generador de calendario las cree por ti."}
      </p>

      {!isKnockout && (
        <form className="row" style={{ alignItems: "flex-end" }} onSubmit={(event: React.FormEvent) => { event.preventDefault(); void run(() => http(`/phases/${phase._id}/matchdays`, { json: { name: newName.trim() || undefined } }), "Fecha creada"); }}>
          <div className="grow"><Input label="Nueva fecha" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Fecha ${(matchdays.at(-1)?.number ?? 0) + 1}`} hint="Deja el nombre vacío para usar el siguiente número." /></div>
          <Button type="submit" icon={<Plus size={16} />} loading={busy}>Agregar</Button>
        </form>
      )}

      {matchdays.length === 0 ? (
        <div className="card"><EmptyState icon={<CalendarDays size={28} />} title="Sin fechas" description="Crea la primera fecha o genera el calendario de la fase." /></div>
      ) : (
        <div className="card flush" style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {matchdays.map((matchday) => (
            <div key={matchday._id} className="list-row">
              {editing === matchday._id ? (
                <form className="row grow" onSubmit={(event: React.FormEvent) => { event.preventDefault(); if (name.trim()) void run(() => http(`/matchdays/${matchday._id}`, { method: "PATCH", json: { name: name.trim() } }), "Fecha renombrada"); }}>
                  <div className="grow"><Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
                  <Button type="submit" size="small" loading={busy}>Guardar</Button>
                  <Button variant="ghost" size="small" onClick={() => setEditing(null)}>Cancelar</Button>
                </form>
              ) : (
                <>
                  <span className="text-secondary" style={{ width: 28 }}>{matchday.number}</span>
                  <div className="grow">
                    <div className="text-strong">{matchday.name}</div>
                    <div className="text-secondary text-small">
                      {matchday.from ? (matchday.from.slice(0, 10) === matchday.to?.slice(0, 10) ? day(matchday.from) : `${day(matchday.from)} – ${day(matchday.to!)}`) : "Sin partidos"}
                    </div>
                  </div>
                  <Badge tone={matchday.matches.total === 0 ? "neutral" : matchday.matches.finished === matchday.matches.total ? "success" : "info"}>
                    {matchday.matches.total === 0 ? "0 partidos" : `${matchday.matches.finished} / ${matchday.matches.total} jugados`}
                  </Badge>
                  <button className="icon-button" disabled={matchday.matches.total === 0} onClick={() => setScheduling(matchday)} aria-label={`Programar ${matchday.name}`} title="Programar días y horas"><CalendarClock size={18} /></button>
                  <button className="icon-button" onClick={() => { setEditing(matchday._id); setName(matchday.name); }} aria-label={`Renombrar ${matchday.name}`} title="Renombrar"><Pencil size={18} /></button>
                  <button className="icon-button" onClick={() => void run(() => http(`/matchdays/${matchday._id}`, { method: "DELETE" }), "Fecha eliminada")} aria-label={`Eliminar ${matchday.name}`} title="Eliminar"><Trash2 size={18} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="action-bar"><Button variant="secondary" onClick={onClose}>Cerrar</Button></div>
      {scheduling && <MatchdayScheduleModal open matchday={scheduling} onClose={() => setScheduling(null)} onSaved={() => { setScheduling(null); list.reload(); onChanged(); }} />}
    </div>
  );
}

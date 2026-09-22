"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import type { Paginated, RosterEntryDTO, TeamDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SuspensionFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Nueva suspensión" onClose={props.onClose}>
      <SuspensionForm {...props} />
    </Modal>
  );
}

function SuspensionForm({ championshipId, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const [teamId, setTeamId] = useState("");
  const roster = useFetch<{ data: RosterEntryDTO[] }>(teamId ? `/teams/${teamId}/roster` : null);
  const [registrationId, setRegistrationId] = useState("");
  const [matches, setMatches] = useState("1");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = Boolean(teamId || registrationId || note.trim() || matches !== "1");
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, onClose);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!registrationId) next.registrationId = "Selecciona al jugador";
    if (note.trim().length < 3) next.note = "Describe el motivo de la suspensión";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await http("/suspensions", { json: { registrationId, matches: Number(matches), note: note.trim() } });
      toast.success("Suspensión registrada");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const players = (roster.data?.data ?? []).filter((entry) => entry.status !== "inactive");
  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <Select label="Equipo" required value={teamId} onChange={(e) => { setTeamId(e.target.value); setRegistrationId(""); }}>
        <option value="">Selecciona un equipo</option>
        {(teams.data?.data ?? []).map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
      </Select>
      <Select label="Jugador" required value={registrationId} onChange={(e) => setRegistrationId(e.target.value)} disabled={!teamId} error={errors.registrationId}>
        <option value="">{teamId ? "Selecciona un jugador" : "Elige primero el equipo"}</option>
        {players.map((entry) => <option key={entry._id} value={entry._id}>#{entry.shirtNumber} · {entry.playerId.fullName}</option>)}
      </Select>
      <Input label="Partidos de suspensión" required type="number" min={1} max={20} value={matches} onChange={(e) => setMatches(e.target.value)} error={errors.matches} />
      <Input label="Motivo" required value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
      <div className="action-bar">
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Suspender</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}

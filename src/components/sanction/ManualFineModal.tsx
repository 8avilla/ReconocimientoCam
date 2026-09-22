"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, ConfirmDialog, Input, Loading, Modal, Select, useToast } from "@/components/ui";
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

export function ManualFineModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Nueva multa" onClose={props.onClose}>
      <ManualFineForm {...props} />
    </Modal>
  );
}

/** A fine that does not come from a card (no-show, misconduct...). */
function ManualFineForm({ championshipId, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const [teamId, setTeamId] = useState("");
  const roster = useFetch<{ data: RosterEntryDTO[] }>(teamId ? `/teams/${teamId}/roster` : null);
  const [playerId, setPlayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = Boolean(teamId || playerId || amount || concept.trim());
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, onClose);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!teamId) next.teamId = "Selecciona el equipo";
    if (!Number.isInteger(Number(amount)) || Number(amount) < 1) next.amount = "Indica el valor de la multa";
    if (concept.trim().length < 3) next.concept = "Describe el motivo";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      await http("/fines", { json: { championshipId, teamId, playerId: playerId || undefined, amount: Number(amount), concept: concept.trim() } });
      toast.success("Multa creada");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!teams.data) return <Loading />;
  return (
    <form onSubmit={submit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <Select label="Equipo" required value={teamId} onChange={(e) => { setTeamId(e.target.value); setPlayerId(""); }} error={errors.teamId}>
        <option value="">Selecciona un equipo</option>
        {teams.data.data.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
      </Select>
      <Select label="Jugador (opcional)" value={playerId} disabled={!teamId} onChange={(e) => setPlayerId(e.target.value)} hint="Déjalo vacío si la multa es para todo el equipo.">
        <option value="">Todo el equipo</option>
        {(roster.data?.data ?? []).map((entry) => <option key={entry.playerId._id} value={entry.playerId._id}>#{entry.shirtNumber} · {entry.playerId.fullName}</option>)}
      </Select>
      <Input label="Valor ($)" type="number" min={1} step={1000} inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
      <Input label="Motivo" required value={concept} onChange={(e) => setConcept(e.target.value)} error={errors.concept} hint="Por ejemplo: inasistencia, reclamo airado..." />
      <div className="action-bar">
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" size="large" loading={saving}>Crear multa</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}

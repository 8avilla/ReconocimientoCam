"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { LEGS_LABEL } from "@/lib/labels";
import type { BracketRoundDTO } from "@/types/api";

interface Props {
  open: boolean;
  phaseId: string;
  /** Round being edited; null creates a new one. */
  round: BracketRoundDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

const NAME_SUGGESTIONS = ["Dieciseisavos de final", "Octavos de final", "Cuartos de final", "Semifinal", "Tercer puesto", "Final"];

export function RoundFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={props.round ? "Editar ronda" : "Nueva ronda"} onClose={props.onClose}>
      <RoundForm key={props.round?._id ?? "new"} {...props} />
    </Modal>
  );
}

function RoundForm({ phaseId, round, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [name, setName] = useState(round?.name ?? "");
  const [legs, setLegs] = useState(String(round?.legs ?? 1));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  // The legs cannot change once the round has matches.
  const locked = Boolean(round?.ties.some((tie) => tie.matches.length > 0));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setErrors({ name: "Este campo es obligatorio" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const json = { name: name.trim(), ...(locked ? {} : { legs: Number(legs) }) };
      if (round) await http(`/phases/${phaseId}/rounds/${round._id}`, { method: "PATCH", json });
      else await http(`/phases/${phaseId}/rounds`, { json });
      toast.success(round ? "Ronda actualizada" : "Ronda creada");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && error.code === "duplicate") setErrors({ name: "Ya existe una ronda con ese nombre" });
      else if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <div className="field">
        <Input label="Nombre de la ronda" required list="round-names" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} hint="Escribe el que quieras o elige una sugerencia." autoComplete="off" />
        <datalist id="round-names">{NAME_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
      </div>
      <Select label="Partidos por cruce" disabled={locked} value={legs} onChange={(e) => setLegs(e.target.value)} hint={locked ? "La ronda ya tiene partidos; elimínalos para cambiar esto." : "Puedes elegir distinto en cada ronda (por ejemplo, ida y vuelta en semifinales y partido único en la final)."}>
        <option value="1">{LEGS_LABEL[1]}</option>
        <option value="2">{LEGS_LABEL[2]}</option>
      </Select>
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{round ? "Guardar cambios" : "Crear ronda"}</Button>
      </div>
    </form>
  );
}

"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, Select, useToast } from "@/components/ui";
import { PHASE_TYPES, type PhaseType } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import { LEGS_LABEL, PHASE_TYPE_LABEL } from "@/lib/labels";
import type { PhaseDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  /** Phase being edited; null creates a new one. */
  phase: PhaseDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PhaseFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={props.phase ? "Editar fase" : "Nueva fase"} onClose={props.onClose}>
      <PhaseForm key={props.phase?._id ?? "new"} {...props} />
    </Modal>
  );
}

function PhaseForm({ championshipId, phase, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [name, setName] = useState(phase?.name ?? "");
  const [type, setType] = useState<PhaseType>(phase?.type ?? "league");
  const [legs, setLegs] = useState(String(phase?.legs ?? 1));
  const [groupCount, setGroupCount] = useState(String(phase?.groupCount ?? 2));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty =
    name.trim() !== (phase?.name ?? "") ||
    type !== (phase?.type ?? "league") ||
    legs !== String(phase?.legs ?? 1) ||
    groupCount !== String(phase?.groupCount ?? 2);
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, onClose);

  // The format cannot change once the phase has a calendar.
  const locked = (phase?.matches.total ?? 0) > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Este campo es obligatorio";
    if (type === "groups" && (!Number.isInteger(Number(groupCount)) || Number(groupCount) < 2)) next.groupCount = "Mínimo 2 grupos";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        ...(locked ? {} : { type, legs: Number(legs), ...(type === "groups" ? { groupCount: Number(groupCount) } : {}) }),
      };
      if (phase) await http(`/phases/${phase._id}`, { method: "PATCH", json: payload });
      else await http(`/championships/${championshipId}/phases`, { json: payload });
      toast.success(phase ? "Fase actualizada" : "Fase creada");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && error.code === "duplicate") setErrors({ name: "Ya existe una fase con ese nombre" });
      else if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <Input label="Nombre de la fase" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Ej.: Fase de grupos" />
      <Select label="Formato" value={type} onChange={(e) => setType(e.target.value as PhaseType)} disabled={locked}>
        {PHASE_TYPES.map((item) => <option key={item} value={item}>{PHASE_TYPE_LABEL[item]}</option>)}
      </Select>
      {type === "knockout" && (
        <p className="text-secondary text-small">Las rondas (octavos, cuartos, final...) las defines tú después, y en cada una eliges si es partido único o ida y vuelta.</p>
      )}
      <div className="form-grid two">
        {type !== "knockout" && <Select label={type === "groups" ? "Partidos dentro de cada grupo" : "Partidos entre equipos"} value={legs} onChange={(e) => setLegs(e.target.value)} disabled={locked}>
          <option value="1">{LEGS_LABEL[1]}</option>
          <option value="2">{LEGS_LABEL[2]}</option>
        </Select>}
        {type === "groups" && (
          <Input label="Número de grupos" required type="number" min={2} max={26} value={groupCount} onChange={(e) => setGroupCount(e.target.value)} error={errors.groupCount} disabled={locked} />
        )}
      </div>
      {locked && (
        <div className="alert info" role="note">
          <AlertCircle size={18} /> La fase ya tiene calendario: solo puedes cambiar su nombre. Para cambiar el formato, reemplaza o elimina sus partidos.
        </div>
      )}
      <div className="action-bar">
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{phase ? "Guardar cambios" : "Crear fase"}</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}

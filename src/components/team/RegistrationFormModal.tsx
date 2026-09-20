"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { POSITIONS, REGISTRATION_STATUSES, type Position, type RegistrationStatus } from "@/lib/constants";
import { REGISTRATION_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, http, HttpError } from "@/lib/client/http";

interface Props {
  open: boolean;
  registrationId: string;
  playerName: string;
  initial: { shirtNumber: number; position: Position; status: RegistrationStatus };
  onClose: () => void;
  onSaved: () => void;
}

export function RegistrationFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={`Inscripción · ${props.playerName}`} onClose={props.onClose}>
      <RegistrationForm key={props.registrationId} {...props} />
    </Modal>
  );
}

function RegistrationForm({ registrationId, initial, onClose, onSaved }: Omit<Props, "open" | "playerName">) {
  const toast = useToast();
  const [shirtNumber, setShirtNumber] = useState(String(initial.shirtNumber));
  const [position, setPosition] = useState<Position>(initial.position);
  const [status, setStatus] = useState<RegistrationStatus>(initial.status);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError("");
    setSaving(true);
    try {
      await http(`/registrations/${registrationId}`, {
        method: "PATCH",
        json: { shirtNumber: Number(shirtNumber), position, status },
      });
      toast.success("Inscripción actualizada");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <div className="form-grid two">
        <Input label="Número de camiseta" type="number" min={0} max={999} required value={shirtNumber} onChange={(e) => setShirtNumber(e.target.value)} error={errors.shirtNumber} />
        <Select label="Posición" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
          {POSITIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      </div>
      <Select
        label="Estado"
        value={status}
        onChange={(e) => setStatus(e.target.value as RegistrationStatus)}
        hint="Un jugador suspendido o inactivo no participa en los partidos."
      >
        {REGISTRATION_STATUSES.map((item) => <option key={item} value={item}>{REGISTRATION_STATUS_LABEL[item].label}</option>)}
      </Select>
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
    </form>
  );
}

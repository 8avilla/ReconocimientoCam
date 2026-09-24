"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { POSITIONS, REGISTRATION_STATUSES, type Position, type RegistrationStatus } from "@/lib/constants";
import { REGISTRATION_STATUS_LABEL } from "@/lib/labels";
import { errorMessage, http, HttpError } from "@/lib/client/http";

interface Registration {
  _id: string;
  shirtNumber?: number | null;
  position?: Position | null;
  status: RegistrationStatus;
}

interface Props {
  open: boolean;
  player: { _id: string; fullName: string; documentId?: string; birthDate?: string };
  /** The player's current team registration, if they have one: also edited here instead of a separate dialog. */
  registration?: Registration | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PlayerFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Editar jugador" onClose={props.onClose}>
      <PlayerForm key={props.player._id} {...props} />
    </Modal>
  );
}

function PlayerForm({ player, registration, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [fullName, setFullName] = useState(player.fullName);
  const [documentId, setDocumentId] = useState(player.documentId ?? "");
  const [birthDate, setBirthDate] = useState(player.birthDate?.slice(0, 10) ?? "");
  const [shirtNumber, setShirtNumber] = useState(registration?.shirtNumber != null ? String(registration.shirtNumber) : "");
  const [position, setPosition] = useState<Position | "">(registration?.position ?? "");
  const [status, setStatus] = useState<RegistrationStatus>(registration?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Este campo es obligatorio";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await Promise.all([
        http(`/players/${player._id}`, {
          method: "PATCH",
          json: { fullName: fullName.trim(), documentId: documentId.trim() || undefined, birthDate: birthDate || undefined },
        }),
        registration
          ? http(`/registrations/${registration._id}`, {
              method: "PATCH",
              json: { shirtNumber: shirtNumber.trim() ? Number(shirtNumber) : undefined, position: position || undefined, status },
            })
          : null,
      ]);
      toast.success("Jugador actualizado");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && error.code === "duplicate") setErrors({ documentId: "El documento ya está registrado" });
      else if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <Input label="Nombre completo" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
      <div className="form-grid two">
        <Input label="Documento (opcional)" value={documentId} onChange={(e) => setDocumentId(e.target.value)} error={errors.documentId} />
        <Input label="Fecha de nacimiento (opcional)" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} error={errors.birthDate} />
      </div>
      {registration && (
        <>
          <div className="form-grid two">
            <Input label="Número de camiseta (opcional)" type="number" min={0} max={999} value={shirtNumber} onChange={(e) => setShirtNumber(e.target.value)} error={errors.shirtNumber} />
            <Select label="Posición (opcional)" value={position} onChange={(e) => setPosition(e.target.value as Position | "")}>
              <option value="">Sin especificar</option>
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
        </>
      )}
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
    </form>
  );
}

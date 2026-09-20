"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";

interface Props {
  open: boolean;
  player: { _id: string; fullName: string; documentId: string; birthDate: string };
  onClose: () => void;
  onSaved: () => void;
}

export function PlayerFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Editar jugador" onClose={props.onClose}>
      <PlayerForm {...props} />
    </Modal>
  );
}

function PlayerForm({ player, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [fullName, setFullName] = useState(player.fullName);
  const [documentId, setDocumentId] = useState(player.documentId);
  const [birthDate, setBirthDate] = useState(player.birthDate.slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Este campo es obligatorio";
    if (!documentId.trim()) next.documentId = "Este campo es obligatorio";
    if (!birthDate) next.birthDate = "Este campo es obligatorio";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await http(`/players/${player._id}`, {
        method: "PATCH",
        json: { fullName: fullName.trim(), documentId: documentId.trim(), birthDate },
      });
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
        <Input label="Documento" required value={documentId} onChange={(e) => setDocumentId(e.target.value)} error={errors.documentId} />
        <Input label="Fecha de nacimiento" required type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} error={errors.birthDate} />
      </div>
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
    </form>
  );
}

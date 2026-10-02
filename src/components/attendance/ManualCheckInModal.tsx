"use client";

import React, { useState } from "react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, HttpError } from "@/lib/client/http";
import { submitAttendance } from "@/lib/client/useOutbox";

interface Props {
  open: boolean;
  matchId: string;
  player: { _id: string; fullName: string };
  onClose: () => void;
  /** `queued`: there was no connection, the change waits on this device to be sent. */
  onSaved: (queued: boolean) => void;
}

/** Contingency: register a player as present or absent without verification; the reason is optional. */
export function ManualCheckInModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={`Registro manual · ${props.player.fullName}`} onClose={props.onClose}>
      <ManualForm key={props.player._id} {...props} />
    </Modal>
  );
}

function ManualForm({ matchId, player, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [status, setStatus] = useState<"present" | "absent">("present");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const outcome = await submitAttendance(matchId, `/matches/${matchId}/check-ins`, { playerId: player._id, status, method: "manual", reason: reason.trim() || undefined });
      toast.success(outcome.queued ? "Sin conexión: guardado en este dispositivo, se enviará al volver la conexión" : "Asistencia registrada");
      onSaved(outcome.queued);
    } catch (err) {
      setError(err instanceof HttpError && err.fieldErrors.reason ? err.fieldErrors.reason : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      <Select label="Asistencia" value={status} onChange={(e) => setStatus(e.target.value as "present" | "absent")}>
        <option value="present">Presente</option>
        <option value="absent">Ausente</option>
      </Select>
      <Input label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} error={error} hint="Ej.: QR dañado, sin conectividad, sin carnet." />
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Registrar</Button>
      </div>
    </form>
  );
}

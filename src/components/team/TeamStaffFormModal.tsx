"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import { TEAM_STAFF_ROLES } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { TEAM_STAFF_ROLE_LABEL } from "@/lib/labels";
import type { TeamDTO, TeamStaffDTO } from "@/types/api";

interface Props {
  open: boolean;
  teamId: string;
  /** Staff member being edited; null adds a new one. */
  member: TeamStaffDTO | null;
  onClose: () => void;
  onSaved: (team: TeamDTO) => void;
}

export function TeamStaffFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={props.member ? "Editar integrante" : "Agregar al cuerpo técnico"} onClose={props.onClose}>
      <TeamStaffForm key={props.member?._id ?? "new"} {...props} />
    </Modal>
  );
}

function TeamStaffForm({ teamId, member, onClose, onSaved }: Omit<Props, "open">) {
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? TEAM_STAFF_ROLES[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
      const fields = { name: name.trim(), role };
      const saved = member
        ? await http<TeamDTO>(`/teams/${teamId}/staff/${member._id}`, { method: "PATCH", json: fields })
        : await http<TeamDTO>(`/teams/${teamId}/staff`, { json: fields });
      onSaved(saved);
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
      <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
        {TEAM_STAFF_ROLES.map((option) => <option key={option} value={option}>{TEAM_STAFF_ROLE_LABEL[option]}</option>)}
      </Select>
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{member ? "Guardar cambios" : "Agregar"}</Button>
      </div>
    </form>
  );
}

"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { PERMISSION_LABEL } from "@/lib/labels";
import { ALL_PERMISSIONS, type Permission } from "@/lib/roles";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import type { RoleDTO } from "@/types/api";

interface Props {
  open: boolean;
  /** Role being edited; null creates a new one. */
  role: RoleDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RoleFormModal({ open, role, onClose, onSaved }: Props) {
  return (
    <Modal open={open} title={role ? "Editar rol" : "Nuevo rol"} onClose={onClose}>
      <RoleForm key={role?._id ?? "new"} role={role} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function RoleForm({ role, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [name, setName] = useState(role?.name ?? "");
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = name !== (role?.name ?? "") || JSON.stringify([...permissions].sort()) !== JSON.stringify([...(role?.permissions ?? [])].sort());
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, onClose);

  function toggle(permission: Permission) {
    setPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

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
      const payload = { name: name.trim(), permissions: [...permissions] };
      if (role) await http(`/roles/${role._id}`, { method: "PATCH", json: payload });
      else await http("/roles", { json: payload });
      toast.success(role ? "Rol actualizado" : "Rol creado");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && error.code === "duplicate") setErrors({ name: "Ya existe un rol con ese nombre" });
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <Input label="Nombre del rol" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <div className="field">
        <label>Permisos</label>
        <div className="stack-sm" style={{ marginTop: "var(--space-sm)" }}>
          {ALL_PERMISSIONS.map((permission) => (
            <label key={permission} className="row" style={{ gap: "var(--space-sm)" }}>
              <input type="checkbox" checked={permissions.has(permission)} onChange={() => toggle(permission)} />
              {PERMISSION_LABEL[permission]}
            </label>
          ))}
        </div>
      </div>
      <div className="action-bar">
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{role ? "Guardar cambios" : "Crear rol"}</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}

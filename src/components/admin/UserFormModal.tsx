"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, ConfirmDialog, Input, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { useUnsavedGuard } from "@/lib/client/useUnsavedGuard";
import { CHAMPIONSHIP_ADMIN_ROLE_NAME } from "@/lib/roles";
import type { Paginated, RoleDTO, UserDTO } from "@/types/api";

interface Props {
  open: boolean;
  /** User being edited; null creates a new one. */
  user: UserDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormModal({ open, user, onClose, onSaved }: Props) {
  return (
    <Modal open={open} title={user ? "Editar usuario" : "Nuevo usuario"} onClose={onClose}>
      <UserForm key={user?._id ?? "new"} user={user} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function UserForm({ user, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const roles = useFetch<Paginated<RoleDTO>>("/roles?limit=100");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  // Empty until the admin actually picks something; a new user's form shows (and, unless changed,
  // submits) the default role below without that pre-selection alone counting as an unsaved edit.
  // `roleTouched` is what makes an explicit "Sin rol asignado" choice stick instead of falling back
  // to the default again (plain emptiness can't tell "never touched" from "chose none" apart).
  const [roleId, setRoleId] = useState(user?.roleId?._id ?? "");
  const [roleTouched, setRoleTouched] = useState(false);
  const defaultRoleId = !user ? roles.data?.data.find((role) => role.name === CHAMPIONSHIP_ADMIN_ROLE_NAME)?._id : undefined;
  const effectiveRoleId = roleTouched ? roleId : roleId || defaultRoleId || "";
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = name !== (user?.name ?? "") || email !== (user?.email ?? "") || roleId !== (user?.roleId?._id ?? "") || isAdmin !== (user?.isAdmin ?? false);
  const { requestClose, confirmProps } = useUnsavedGuard(dirty, onClose);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!name.trim()) clientErrors.name = "Este campo es obligatorio";
    if (!user && !email.trim()) clientErrors.email = "Este campo es obligatorio";
    setErrors(clientErrors);
    setFormError("");
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      if (user) {
        await http(`/users/${user._id}`, { method: "PATCH", json: { name: name.trim(), roleId: effectiveRoleId || null, isAdmin } });
        toast.success("Usuario actualizado");
      } else {
        await http("/users", { json: { name: name.trim(), email: email.trim(), roleId: effectiveRoleId || undefined, isAdmin } });
        toast.success("Usuario creado. Envíale el enlace para que defina su contraseña.");
      }
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else if (error instanceof HttpError && error.code === "duplicate") setErrors({ email: "Ya existe un usuario con ese correo" });
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      <Input label="Nombre completo" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <Input
        label="Correo"
        type="email"
        required={!user}
        disabled={Boolean(user)}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        hint={user ? "El correo no se puede cambiar." : undefined}
      />
      <Select label="Rol (opcional)" value={effectiveRoleId} onChange={(e) => { setRoleId(e.target.value); setRoleTouched(true); }}>
        <option value="">Sin rol asignado</option>
        {(roles.data?.data ?? []).map((role) => <option key={role._id} value={role._id}>{role.name}</option>)}
      </Select>
      <label className="row" style={{ gap: "var(--space-sm)" }}>
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        Es administrador del sistema (acceso total, no depende del rol)
      </label>
      <div className="action-bar">
        <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{user ? "Guardar cambios" : "Crear usuario"}</Button>
      </div>
      <ConfirmDialog {...confirmProps} />
    </form>
  );
}

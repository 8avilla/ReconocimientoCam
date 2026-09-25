"use client";

import { useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { ActionMenu, Button, ConfirmDialog, EmptyState, ErrorState, Loading, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { PERMISSION_LABEL } from "@/lib/labels";
import { RoleFormModal } from "./RoleFormModal";
import type { Paginated, RoleDTO } from "@/types/api";

export function RolesManager() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch<Paginated<RoleDTO>>("/roles?limit=100");
  const roles = data?.data ?? [];
  const [editing, setEditing] = useState<RoleDTO | null | "new">(null);
  const [deleting, setDeleting] = useState<RoleDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await http(`/roles/${deleting._id}`, { method: "DELETE" });
      toast.success("Rol eliminado");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: "var(--space-lg)" }}>
        <p className="text-secondary text-small grow">Define qué puede hacer cada rol; luego asígnalo a un usuario desde la pestaña Usuarios.</p>
        <Button icon={<Plus size={18} />} onClick={() => setEditing("new")}>Nuevo rol</Button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : roles.length === 0 ? (
        <div className="card"><EmptyState icon={<ShieldCheck size={28} />} title="Sin roles todavía" description="Crea un rol y elige qué permisos tiene." action={<Button onClick={() => setEditing("new")}>Crear rol</Button>} /></div>
      ) : (
        <div className="card-grid">
          {roles.map((role) => (
            <div key={role._id} className="card stack-sm">
              <div className="row-between">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="text-strong truncate">{role.name}</div>
                  <div className="text-secondary text-small">{role.permissions.length} {role.permissions.length === 1 ? "permiso" : "permisos"}</div>
                </div>
                <ActionMenu
                  label={`Más acciones de ${role.name}`}
                  actions={[
                    { label: "Editar", icon: <Pencil size={16} />, onClick: () => setEditing(role) },
                    { label: "Eliminar", icon: <Trash2 size={16} />, danger: true, onClick: () => setDeleting(role) },
                  ]}
                />
              </div>
              {role.permissions.length > 0 && (
                <div className="row-wrap" style={{ gap: 6 }}>
                  {role.permissions.map((permission) => (
                    <span key={permission} className="filter-chip" style={{ cursor: "default" }}>{PERMISSION_LABEL[permission]}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <RoleFormModal
        open={editing !== null}
        role={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar rol"
        message={`¿Eliminar el rol "${deleting?.name}"? Solo se puede si ningún usuario lo tiene asignado.`}
        confirmLabel="Eliminar"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

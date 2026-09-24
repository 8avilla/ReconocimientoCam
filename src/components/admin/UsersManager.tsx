"use client";

import { useEffect, useState } from "react";
import { Mail, Plus, Search, Users } from "lucide-react";
import { Pencil, Trash2 } from "lucide-react";
import { ActionMenu, Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Loading, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { UserFormModal } from "./UserFormModal";
import type { Paginated, UserDTO } from "@/types/api";

const PAGE_SIZE = 30;

export function UsersManager() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pages, setPages] = useState(1);
  const [editing, setEditing] = useState<UserDTO | null | "new">(null);
  const [deleting, setDeleting] = useState<UserDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams({ limit: String(PAGE_SIZE * pages) });
  if (debouncedSearch) params.set("q", debouncedSearch);
  const { data, error, loading, reload } = useFetch<Paginated<UserDTO>>(`/users?${params}`);
  const users = data?.data ?? [];
  const hasMore = data ? users.length < data.meta.total : false;

  async function sendPasswordLink(user: UserDTO) {
    try {
      await http(`/users/${user._id}/send-password-link`, { method: "POST" });
      toast.success(`Enlace enviado a ${user.email}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await http(`/users/${deleting._id}`, { method: "DELETE" });
      toast.success("Usuario eliminado");
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
        <div className="search grow" style={{ maxWidth: 420 }}>
          <Search size={18} aria-hidden />
          <input className="input" type="search" placeholder="Buscar por nombre o correo..." aria-label="Buscar usuario" value={search} onChange={(e) => { setSearch(e.target.value); setPages(1); }} />
        </div>
        <Button icon={<Plus size={18} />} onClick={() => setEditing("new")}>Nuevo usuario</Button>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : users.length === 0 ? (
        <div className="card"><EmptyState icon={<Users size={28} />} title="Sin usuarios" description="Aún no hay usuarios que coincidan." /></div>
      ) : (
        <>
          <div className="flush-list">
            {users.map((user) => (
              <div key={user._id} className="list-row">
                <Avatar src={user.image} name={user.name} size={40} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="text-strong truncate">{user.name}</div>
                  <div className="text-secondary text-small truncate">{user.email}</div>
                </div>
                {/* isAdmin is the real access-all switch; showing "Sistema" here instead of a separate
                    role badge keeps the two ideas from looking like independent, possibly-conflicting facts. */}
                {user.isAdmin ? <Badge tone="success">Sistema</Badge> : user.roleId && <Badge tone="info">{user.roleId.name}</Badge>}
                <ActionMenu
                  label={`Más acciones de ${user.name}`}
                  actions={[
                    { label: "Editar", icon: <Pencil size={16} />, onClick: () => setEditing(user) },
                    { label: "Enviar enlace de contraseña", icon: <Mail size={16} />, onClick: () => sendPasswordLink(user) },
                    { label: "Eliminar", icon: <Trash2 size={16} />, danger: true, onClick: () => setDeleting(user) },
                  ]}
                />
              </div>
            ))}
          </div>
          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-lg)" }}>
              <Button variant="secondary" loading={loading} onClick={() => setPages((current) => current + 1)}>Mostrar más</Button>
            </div>
          )}
        </>
      )}

      <UserFormModal
        open={editing !== null}
        user={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar usuario"
        message={`¿Eliminar a "${deleting?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

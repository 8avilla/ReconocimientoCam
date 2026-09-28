"use client";

import { useState } from "react";
import { Trash2, UserCog, Users } from "lucide-react";
import { TeamStaffFormModal } from "@/components/team/TeamStaffFormModal";
import { ActionMenu, Badge, Button, ConfirmDialog, EmptyState, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { TEAM_STAFF_ROLE_LABEL } from "@/lib/labels";
import type { TeamStaffDTO } from "@/types/api";

/** Coaching staff (head coach, assistants, physical trainer, etc.) shown as its own block within the
 * team's "Plantilla" tab, above the player roster — separate people, so they get their own list. */
export function TeamStaffBlock({ teamId, staff, canManage, onChanged }: { teamId: string; staff: TeamStaffDTO[]; canManage: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [formTarget, setFormTarget] = useState<TeamStaffDTO | "new" | null>(null);
  const [toDelete, setToDelete] = useState<TeamStaffDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await http(`/teams/${teamId}/staff/${toDelete._id}`, { method: "DELETE" });
      toast.success("Integrante eliminado del cuerpo técnico");
      setToDelete(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="flush-list" aria-label="Cuerpo técnico" style={{ marginBottom: "var(--space-lg)" }}>
      <div className="band band-muted band-small row-between" style={{ minHeight: 48 }}>
        <h2 className="band-small" style={{ padding: 0, background: "none" }}>
          Cuerpo técnico {staff.length > 0 && <span className="text-secondary">({staff.length})</span>}
        </h2>
        {canManage && <Button variant="secondary" size="small" icon={<UserCog size={16} aria-hidden />} onClick={() => setFormTarget("new")}>Agregar</Button>}
      </div>

      {staff.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users size={28} />} title="Sin cuerpo técnico registrado" description="Agrega al entrenador y su equipo de apoyo." />
        </div>
      ) : (
        <ul style={{ listStyle: "none", background: "var(--color-surface)" }}>
          {staff.map((member) => (
            <li key={member._id} className="list-row">
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="text-strong truncate">{member.name}</div>
                <Badge tone="neutral">{TEAM_STAFF_ROLE_LABEL[member.role]}</Badge>
              </div>
              {canManage && (
                <ActionMenu
                  label={`Más acciones de ${member.name}`}
                  actions={[
                    { label: "Editar", icon: <UserCog size={16} />, onClick: () => setFormTarget(member) },
                    { label: "Eliminar", icon: <Trash2 size={16} />, danger: true, onClick: () => setToDelete(member) },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {formTarget && (
        <TeamStaffFormModal
          open
          teamId={teamId}
          member={formTarget === "new" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            onChanged();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar del cuerpo técnico"
        message={`¿Eliminar a "${toDelete?.name}" del cuerpo técnico?`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}

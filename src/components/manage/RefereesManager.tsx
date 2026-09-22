"use client";

import React, { useState } from "react";
import { AlertCircle, Pencil, Plus, Power, Trash2, Whistle } from "lucide-react";
import { ActionMenu, Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Fab, Input, Loading, Modal, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { RefereeDTO } from "@/types/api";

/** Referees of the championship: who can be assigned to matches. */
export function RefereesManager({ championshipId }: { championshipId: string }) {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch<{ data: RefereeDTO[] }>(`/referees?championshipId=${championshipId}`);
  const [editing, setEditing] = useState<RefereeDTO | null | "new">(null);
  const [deleting, setDeleting] = useState<RefereeDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const referees = data?.data ?? [];

  async function toggleActive(referee: RefereeDTO) {
    try {
      await http(`/referees/${referee._id}`, { method: "PATCH", json: { active: !referee.active } });
      toast.success(referee.active ? "Árbitro desactivado" : "Árbitro activado");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await http(`/referees/${deleting._id}`, { method: "DELETE" });
      toast.success("Árbitro eliminado");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: "var(--space-lg)" }}>
        <p className="text-secondary">Los árbitros que pueden dirigir los partidos del campeonato.</p>
        <Button icon={<Plus size={18} />} className="only-desktop" onClick={() => setEditing("new")}>Nuevo árbitro</Button>
      </div>
      <Fab label="Árbitros" actions={[{ label: "Nuevo árbitro", onClick: () => setEditing("new") }]} />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : referees.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Whistle size={28} />} title="Aún no hay árbitros" description="Agrega a los árbitros para asignarlos a los partidos al programarlos." action={<Button onClick={() => setEditing("new")}>Agregar árbitro</Button>} />
        </div>
      ) : (
        <div className="flush-list">
          <h2 className="band band-muted band-small">Árbitros ({referees.length})</h2>
          {referees.map((referee) => (
            <div key={referee._id} className="list-row" style={{ opacity: referee.active ? 1 : 0.6 }}>
              <Avatar name={referee.fullName} size={44} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="champ-caption truncate">{[referee.phone, referee.documentId && `Doc. ${referee.documentId}`].filter(Boolean).join(" · ") || "Sin datos de contacto"}</div>
                <div className="champ-name truncate">{referee.fullName}</div>
                <div className="text-secondary text-small">{referee.matchCount} {referee.matchCount === 1 ? "partido" : "partidos"}</div>
              </div>
              {!referee.active && <Badge tone="neutral">Inactivo</Badge>}
              <ActionMenu
                label={`Más acciones de ${referee.fullName}`}
                actions={[
                  { label: "Editar", icon: <Pencil size={18} />, onClick: () => setEditing(referee) },
                  { label: referee.active ? "Desactivar" : "Activar", icon: <Power size={18} />, onClick: () => void toggleActive(referee) },
                  { label: "Eliminar", icon: <Trash2 size={18} />, danger: true, onClick: () => setDeleting(referee) },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RefereeFormModal
          championshipId={championshipId}
          referee={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar árbitro"
        message={`¿Eliminar a ${deleting?.fullName}? Si ya tiene partidos asignados, desactívalo en su lugar.`}
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function RefereeFormModal({ championshipId, referee, onClose, onSaved }: { championshipId: string; referee: RefereeDTO | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [fullName, setFullName] = useState(referee?.fullName ?? "");
  const [phone, setPhone] = useState(referee?.phone ?? "");
  const [documentId, setDocumentId] = useState(referee?.documentId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (fullName.trim().length < 2) {
      setErrors({ fullName: "Escribe el nombre del árbitro" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const fields = { fullName: fullName.trim(), phone: phone.trim(), documentId: documentId.trim() };
      if (referee) await http(`/referees/${referee._id}`, { method: "PATCH", json: fields });
      else await http("/referees", { json: { ...fields, championshipId } });
      toast.success(referee ? "Árbitro actualizado" : "Árbitro creado");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={referee ? "Editar árbitro" : "Nuevo árbitro"} onClose={onClose}>
      <form onSubmit={submit} className="stack" noValidate>
        {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
        <Input label="Nombre completo" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
        <div className="form-grid two">
          <Input label="Teléfono (opcional)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
          <Input label="Documento (opcional)" value={documentId} onChange={(e) => setDocumentId(e.target.value)} error={errors.documentId} />
        </div>
        <div className="action-bar">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving}>{referee ? "Guardar cambios" : "Crear árbitro"}</Button>
        </div>
      </form>
    </Modal>
  );
}

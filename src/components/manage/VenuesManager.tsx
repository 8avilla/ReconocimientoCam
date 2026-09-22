"use client";

import React, { useState } from "react";
import { AlertCircle, MapPin, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { ActionMenu, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Fab, Input, Loading, Modal, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { VenueDTO } from "@/types/api";

/** Places where matches are played (canchas): offered as suggestions when scheduling. */
export function VenuesManager({ championshipId }: { championshipId: string }) {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch<{ data: VenueDTO[] }>(`/venues?championshipId=${championshipId}`);
  const [editing, setEditing] = useState<VenueDTO | null | "new">(null);
  const [deleting, setDeleting] = useState<VenueDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const venues = data?.data ?? [];

  async function toggleActive(venue: VenueDTO) {
    try {
      await http(`/venues/${venue._id}`, { method: "PATCH", json: { active: !venue.active } });
      toast.success(venue.active ? "Sitio desactivado" : "Sitio activado");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await http(`/venues/${deleting._id}`, { method: "DELETE" });
      toast.success("Sitio eliminado");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: "var(--space-lg)" }}>
        <p className="text-secondary">Las canchas o sitios donde se juegan los partidos. Al programar, eliges uno de esta lista (o escribes otro).</p>
        <Button icon={<Plus size={18} />} className="only-desktop" onClick={() => setEditing("new")}>Nuevo sitio</Button>
      </div>
      <Fab label="Sitios" actions={[{ label: "Nuevo sitio", onClick: () => setEditing("new") }]} />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : venues.length === 0 ? (
        <div className="card">
          <EmptyState icon={<MapPin size={28} />} title="Aún no hay sitios" description="Agrega las canchas del campeonato para elegirlas rápido al programar los partidos." action={<Button onClick={() => setEditing("new")}>Agregar sitio</Button>} />
        </div>
      ) : (
        <div className="flush-list">
          <h2 className="band band-muted band-small">Sitios ({venues.length})</h2>
          {venues.map((venue) => (
            <div key={venue._id} className="list-row" style={{ opacity: venue.active ? 1 : 0.6 }}>
              <span className="attention-icon today" aria-hidden><MapPin size={20} /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="champ-caption truncate">{venue.address || "Sin dirección"}</div>
                <div className="champ-name truncate">{venue.name}</div>
                <div className="text-secondary text-small">{venue.matchCount} {venue.matchCount === 1 ? "partido" : "partidos"}{venue.notes && ` · ${venue.notes}`}</div>
              </div>
              {!venue.active && <Badge tone="neutral">Inactivo</Badge>}
              <ActionMenu
                label={`Más acciones de ${venue.name}`}
                actions={[
                  { label: "Editar", icon: <Pencil size={18} />, onClick: () => setEditing(venue) },
                  { label: venue.active ? "Desactivar" : "Activar", icon: <Power size={18} />, onClick: () => void toggleActive(venue) },
                  { label: "Eliminar", icon: <Trash2 size={18} />, danger: true, onClick: () => setDeleting(venue) },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      {editing && (
        <VenueFormModal
          championshipId={championshipId}
          venue={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar sitio"
        message={`¿Eliminar «${deleting?.name}»? Los partidos ya programados allí conservan su nombre.`}
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function VenueFormModal({ championshipId, venue, onClose, onSaved }: { championshipId: string; venue: VenueDTO | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [notes, setNotes] = useState(venue?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (name.trim().length < 2) {
      setErrors({ name: "Escribe el nombre del sitio" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const fields = { name: name.trim(), address: address.trim(), notes: notes.trim() };
      if (venue) await http(`/venues/${venue._id}`, { method: "PATCH", json: fields });
      else await http("/venues", { json: { ...fields, championshipId } });
      toast.success(venue ? "Sitio actualizado" : "Sitio creado");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={venue ? "Editar sitio" : "Nuevo sitio"} onClose={onClose}>
      <form onSubmit={submit} className="stack" noValidate>
        {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
        <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} hint="Por ejemplo: Cancha La 10" />
        <Input label="Dirección (opcional)" value={address} onChange={(e) => setAddress(e.target.value)} error={errors.address} />
        <Input label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} hint="Cómo llegar, horarios disponibles..." />
        <div className="action-bar">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving}>{venue ? "Guardar cambios" : "Crear sitio"}</Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { CalendarRange, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { ChampionshipFormModal } from "@/components/championship/ChampionshipFormModal";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { CHAMPIONSHIP_FORMAT_LABEL, CHAMPIONSHIP_STATUS_LABEL, formatDate } from "@/lib/labels";
import type { ChampionshipDTO } from "@/types/api";

export default function ChampionshipsPage() {
  const toast = useToast();
  const { championships, current, setCurrentId, loading, error, reload } = useChampionship();
  const [editing, setEditing] = useState<ChampionshipDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<ChampionshipDTO | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openForm = (championship: ChampionshipDTO | null) => {
    setEditing(championship);
    setFormOpen(true);
  };

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await http(`/championships/${deleting._id}`, { method: "DELETE" });
      toast.success("Campeonato eliminado");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Campeonatos"
        description="Configura los campeonatos y elige cuál está activo."
        actions={<Button icon={<Plus size={18} />} onClick={() => openForm(null)}>Nuevo campeonato</Button>}
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && championships.length === 0 ? (
        <Loading />
      ) : championships.length === 0 ? (
        <EmptyState
          icon={<Trophy size={28} />}
          title="Aún no hay campeonatos"
          description="Crea tu primer campeonato para comenzar."
          action={<Button onClick={() => openForm(null)}>Crear campeonato</Button>}
        />
      ) : (
        <div className="card-grid">
          {championships.map((championship) => {
            const status = CHAMPIONSHIP_STATUS_LABEL[championship.status];
            const isCurrent = current?._id === championship._id;
            return (
              <article key={championship._id} className="card stack">
                <div className="row-between">
                  <div className="grow">
                    <h3 className="truncate">{championship.name}</h3>
                    <p className="text-secondary">Temporada {championship.season}</p>
                  </div>
                  {isCurrent && <Badge tone="success">Activo</Badge>}
                </div>
                <div className="row-wrap">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <Badge>{CHAMPIONSHIP_FORMAT_LABEL[championship.format]}</Badge>
                </div>
                <p className="text-secondary text-small row">
                  <CalendarRange size={16} aria-hidden />
                  {formatDate(championship.startDate)} – {formatDate(championship.endDate)}
                </p>
                <div className="row-between">
                  <Button variant="secondary" size="small" disabled={isCurrent} onClick={() => setCurrentId(championship._id)}>
                    {isCurrent ? "Seleccionado" : "Seleccionar"}
                  </Button>
                  <div className="row">
                    <button className="icon-button" onClick={() => openForm(championship)} aria-label={`Editar ${championship.name}`} title="Editar">
                      <Pencil size={20} />
                    </button>
                    <button className="icon-button" onClick={() => setDeleting(championship)} aria-label={`Eliminar ${championship.name}`} title="Eliminar">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ChampionshipFormModal
        open={formOpen}
        championship={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          if (!editing) setCurrentId(saved._id);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar campeonato"
        message={`¿Eliminar "${deleting?.name}"? Solo es posible si no tiene equipos ni partidos.`}
        confirmLabel="Eliminar"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

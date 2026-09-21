"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Layers, Pencil, Plus, Search, Star, Trash2, Trophy } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { ChampionshipFormModal } from "@/components/championship/ChampionshipFormModal";
import { ActionMenu, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import type { ChampionshipDTO } from "@/types/api";

export default function ChampionshipsPage() {
  const toast = useToast();
  const { championships, current, setCurrentId, favoriteIds, toggleFavorite, loading, error, reload } = useChampionship();
  const { can } = useRole();
  const manage = can("championship.manage");
  const [editing, setEditing] = useState<ChampionshipDTO | null>(null);
  const [search, setSearch] = useState("");
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

  const term = search.trim().toLowerCase();
  const matching = championships.filter((item) => !term || `${item.name} ${item.season}`.toLowerCase().includes(term));
  const favorites = matching.filter((item) => favoriteIds.has(item._id));
  const others = matching.filter((item) => !favoriteIds.has(item._id));

  const renderRow = (championship: ChampionshipDTO) => {
    const status = CHAMPIONSHIP_STATUS_LABEL[championship.status];
    const isCurrent = current?._id === championship._id;
    const followed = favoriteIds.has(championship._id);
    return (
      <div key={championship._id} className="champ-row">
        {/* Organizers open the setup; visitors just pick it as the championship they are watching. */}
        <Link href={manage ? `/championships/${championship._id}` : "/"} className="row grow" style={{ minWidth: 0 }} onClick={() => !manage && setCurrentId(championship._id)}>
          <span className="champ-tile" aria-hidden><Trophy size={22} /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="champ-caption">Temporada {championship.season} · {status.label}</div>
            <div className="champ-name truncate">{championship.name}</div>
          </div>
        </Link>
        {isCurrent && <Badge tone="success">Activo</Badge>}
        <button
          className={`star-button${followed ? " on" : ""}`}
          aria-pressed={followed}
          aria-label={followed ? `Dejar de seguir ${championship.name}` : `Seguir ${championship.name}`}
          onClick={() => {
            toggleFavorite(championship._id);
            toast.success(followed ? `Dejaste de seguir ${championship.name}` : `Ahora sigues ${championship.name}`);
          }}
        >
          <Star size={22} fill={followed ? "currentColor" : "none"} />
        </button>
        <ActionMenu
          label={`Más acciones de ${championship.name}`}
          actions={[
            { label: isCurrent ? "Seleccionado" : "Seleccionar como activo", icon: <Check size={18} />, disabled: isCurrent, onClick: () => { setCurrentId(championship._id); toast.success(`Campeonato activo: ${championship.name}`); } },
            ...(manage ? [
              { label: "Configurar fases", icon: <Layers size={18} />, href: `/championships/${championship._id}` },
              { label: "Editar", icon: <Pencil size={18} />, onClick: () => openForm(championship) },
            ] : []),
            ...(can("championship.delete") ? [{ label: "Eliminar", icon: <Trash2 size={18} />, danger: true, onClick: () => setDeleting(championship) }] : []),
          ]}
        />
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Campeonatos"
        description={manage ? "Configura tus campeonatos, sigue con la estrella los que te interesan y elige cuál está activo." : "Sigue los campeonatos con la estrella y elige cuál quieres ver."}
        actions={manage && <Button icon={<Plus size={18} />} onClick={() => openForm(null)}>Nuevo campeonato</Button>}
        mobileActions={manage ? [{ label: "Nuevo campeonato", icon: <Plus size={20} />, onClick: () => openForm(null) }] : undefined}
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
          action={manage && <Button onClick={() => openForm(null)}>Crear campeonato</Button>}
        />
      ) : (
        <>
        <div className="search" style={{ marginBottom: "var(--space-lg)", maxWidth: 420 }}>
          <Search size={18} aria-hidden />
          <input className="input" type="search" placeholder="Buscar campeonato o temporada..." aria-label="Buscar campeonato" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {matching.length === 0 ? (
          <div className="card"><EmptyState icon={<Search size={28} />} title="Sin resultados" description={`No hay campeonatos que coincidan con "${search.trim()}".`} action={<Button variant="secondary" onClick={() => setSearch("")}>Limpiar búsqueda</Button>} /></div>
        ) : (
        <div className="champ-list">
          {favorites.length > 0 && (
            <section aria-label="Competencias favoritas">
              <h2 className="band band-favorite">Competencias favoritas</h2>
              {favorites.map(renderRow)}
            </section>
          )}
          {others.length > 0 && (
            <section aria-label="Todas las competencias">
              <h2 className="band band-muted">{favorites.length > 0 ? "Otras competencias" : "Competencias"}</h2>
              {others.map(renderRow)}
            </section>
          )}
        </div>
        )}
        </>
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

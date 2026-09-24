"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { championshipPath } from "@/lib/paths";
import { Layers, Pencil, Plus, Search, Star, Trash2, Trophy } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { useChampionship } from "@/components/layout/ChampionshipContext";
import { ChampionshipFormModal } from "@/components/championship/ChampionshipFormModal";
import { ChampionshipTile } from "@/components/championship/ChampionshipTile";
import { ActionMenu, Button, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import type { ChampionshipDTO } from "@/types/api";

export function ChampionshipsView() {
  const toast = useToast();
  const router = useRouter();
  const { championships, favoriteIds, toggleFavorite, loading, error, reload } = useChampionship();
  const { user, isSignedIn, canManageChampionship } = useRole();
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
    const followed = favoriteIds.has(championship._id);
    const manageThis = canManageChampionship(championship);
    return (
      <div key={championship._id} className="champ-row">
        {/* Tapping a championship always does the same for everyone: go into it. */}
        <Link href={championshipPath(championship._id)} className="row grow" style={{ minWidth: 0 }}>
          <ChampionshipTile logoUrl={championship.logoUrl} size={44} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="champ-caption">Temporada {championship.season} · {status.label}</div>
            <div className="champ-name truncate">{championship.name}</div>
          </div>
        </Link>
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
        {(manageThis || user?.isAdmin) && (
          <ActionMenu
            label={`Más acciones de ${championship.name}`}
            actions={[
              ...(manageThis ? [
                { label: "Gestionar", icon: <Layers size={18} />, href: championshipPath(championship._id, "gestionar") },
                { label: "Editar", icon: <Pencil size={18} />, onClick: () => openForm(championship) },
              ] : []),
              ...(user?.isAdmin ? [{ label: "Eliminar", icon: <Trash2 size={18} />, danger: true, onClick: () => setDeleting(championship) }] : []),
            ]}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Campeonatos"
        description="Elige un campeonato para entrar. Con la estrella marcas los que sigues."
        actions={isSignedIn && <Button icon={<Plus size={18} />} onClick={() => openForm(null)}>Nuevo campeonato</Button>}
        mobileActions={isSignedIn ? [{ label: "Nuevo campeonato", icon: <Plus size={20} />, onClick: () => openForm(null) }] : undefined}
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && championships.length === 0 ? (
        <Loading />
      ) : championships.length === 0 ? (
        <EmptyState
          icon={<Trophy size={28} />}
          title="Aún no hay campeonatos"
          description={isSignedIn ? "Crea tu primer campeonato para comenzar." : "Inicia sesión con Google para crear el primero."}
          action={isSignedIn && <Button onClick={() => openForm(null)}>Crear campeonato</Button>}
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
          if (!editing) router.push(championshipPath(saved._id, "gestionar"));
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

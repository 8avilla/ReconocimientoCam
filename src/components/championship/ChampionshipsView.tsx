"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { championshipPath } from "@/lib/paths";
import { LogIn, Plus, Search, Star, Trophy } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { useChampionship, useChampionshipList } from "@/components/layout/ChampionshipContext";
import { AccountModal } from "@/components/layout/RoleSwitcher";
import { ChampionshipFormModal } from "@/components/championship/ChampionshipFormModal";
import { ChampionshipTile } from "@/components/championship/ChampionshipTile";
import { Badge, Button, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/lib/labels";
import type { ChampionshipDTO } from "@/types/api";

type Sort = "recent" | "name";

export function ChampionshipsView() {
  const toast = useToast();
  const router = useRouter();
  const { favoriteIds, toggleFavorite } = useChampionship();
  const { championships, loading, error, reload } = useChampionshipList();
  const { isSignedIn, canManageChampionship } = useRole();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  // Creates a new championship only — editing an existing one now happens from its own "Configuración" panel.
  const [formOpen, setFormOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const term = search.trim().toLowerCase();
  const byName = (a: ChampionshipDTO, b: ChampionshipDTO) => a.name.localeCompare(b.name);
  const applySort = (list: ChampionshipDTO[]) => (sort === "name" ? [...list].sort(byName) : list);

  const matching = championships.filter((item) => !term || `${item.name} ${item.season}`.toLowerCase().includes(term));
  // "Mine" is anything I organize or chose to follow; everything else is there to discover.
  const mine = isSignedIn ? applySort(matching.filter((item) => canManageChampionship(item) || favoriteIds.has(item._id))) : [];
  // "Todos los torneos" lists every championship that is not a draft, including the ones already shown under "Mis torneos".
  const discover = applySort(matching.filter((item) => item.status !== "draft"));

  const renderRow = (championship: ChampionshipDTO) => {
    const status = CHAMPIONSHIP_STATUS_LABEL[championship.status];
    const followed = favoriteIds.has(championship._id);
    return (
      <div key={championship._id} className="champ-row">
        {/* Tapping a championship always does the same for everyone: go into it. */}
        <Link href={championshipPath(championship.slug || championship._id)} className="row grow" style={{ minWidth: 0 }}>
          <ChampionshipTile logoUrl={championship.logoUrl} size={48} />
          <div className="grow stack-xs" style={{ minWidth: 0 }}>
            <div className="text-strong truncate" style={{ fontSize: 15 }}>{championship.name}</div>
            <div className="text-secondary text-small">Temporada {championship.season}</div>
            <Badge tone={status.tone}>{status.label}</Badge>
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
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Torneos"
        description={isSignedIn ? "Gestiona tus torneos y temporadas desde un solo lugar." : "Descubre, sigue y gestiona torneos de fútbol amateur."}
        actions={<Button icon={<Plus size={18} />} onClick={() => (isSignedIn ? setFormOpen(true) : setAccountOpen(true))}>{isSignedIn ? "Nuevo torneo" : "Crear torneo"}</Button>}
        mobileActions={[{ label: isSignedIn ? "Nuevo torneo" : "Crear torneo", icon: <Plus size={20} />, onClick: () => (isSignedIn ? setFormOpen(true) : setAccountOpen(true)) }]}
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && championships.length === 0 ? (
        <Loading />
      ) : (
        <>
        <div className="search" style={{ marginBottom: "var(--space-lg)", maxWidth: 420 }}>
          <Search size={18} aria-hidden />
          <input className="input" type="search" placeholder="Buscar torneo o temporada..." aria-label="Buscar torneo" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <section aria-label="Mis torneos" style={{ marginBottom: "var(--space-xl)" }}>
          <div className="row-between" style={{ marginBottom: "var(--space-sm)" }}>
            <h2 style={{ fontSize: 17 }}>Mis torneos</h2>
            {isSignedIn && mine.length > 0 && (
              <select className="input" aria-label="Ordenar mis torneos" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: "auto", fontSize: 13 }}>
                <option value="recent">Más recientes</option>
                <option value="name">Nombre (A-Z)</option>
              </select>
            )}
          </div>
          {!isSignedIn ? (
            <div className="card">
              <EmptyState
                icon={<Trophy size={28} />}
                title="Inicia sesión para ver tus torneos"
                description="Crea tus propios torneos o sigue otros para verlos aquí."
                action={<Button onClick={() => setAccountOpen(true)}><LogIn size={18} aria-hidden /> Iniciar sesión</Button>}
              />
            </div>
          ) : mine.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Trophy size={28} />}
                title="Crea tu primer torneo"
                description="Organiza equipos, jugadores, partidos y clasificaciones de forma fácil y rápida."
                action={<Button onClick={() => setFormOpen(true)}>Crear torneo</Button>}
              />
            </div>
          ) : (
            <div className="champ-list">{mine.map(renderRow)}</div>
          )}
        </section>

        <section aria-label="Todos los torneos">
          <h2 style={{ fontSize: 17, marginBottom: "var(--space-sm)" }}>Todos los torneos</h2>
          {discover.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Search size={28} />}
                title="Sin resultados"
                description={term ? `No hay torneos que coincidan con "${search.trim()}".` : "No hay más torneos públicos por ahora."}
                action={term ? <Button variant="secondary" onClick={() => setSearch("")}>Limpiar búsqueda</Button> : undefined}
              />
            </div>
          ) : (
            <div className="champ-list">{discover.map(renderRow)}</div>
          )}
        </section>
        </>
      )}

      <ChampionshipFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          router.push(championshipPath(saved.slug || saved._id, "gestionar"));
          reload();
        }}
      />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

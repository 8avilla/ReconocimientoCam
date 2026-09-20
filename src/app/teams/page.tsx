"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Shield } from "lucide-react";
import { RequireChampionship } from "@/components/layout/RequireChampionship";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { Avatar, Badge, Button, EmptyState, ErrorState, Loading, PageHeader } from "@/components/ui";
import { useFetch } from "@/lib/client/useFetch";
import type { Paginated, TeamDTO } from "@/types/api";

export default function TeamsPage() {
  return <RequireChampionship>{(championship) => <TeamsList championshipId={championship._id} />}</RequireChampionship>;
}

function TeamsList({ championshipId }: { championshipId: string }) {
  const { data, error, loading, reload } = useFetch<Paginated<TeamDTO>>(`/teams?championshipId=${championshipId}&limit=100`);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const teams = (data?.data ?? []).filter((team) => team.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <PageHeader
        title="Equipos"
        description="Gestiona los equipos del campeonato."
        actions={<Button icon={<Plus size={18} />} onClick={() => setFormOpen(true)}>Nuevo equipo</Button>}
      />

      <div className="search" style={{ marginBottom: "var(--space-lg)", maxWidth: 420 }}>
        <Search size={18} aria-hidden />
        <input className="input" type="search" placeholder="Buscar equipo..." aria-label="Buscar equipo" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={<Shield size={28} />}
          title={search ? "Sin resultados" : "Aún no hay equipos"}
          description={search ? "Prueba con otro nombre." : "Registra el primer equipo de este campeonato."}
          action={!search && <Button onClick={() => setFormOpen(true)}>Crear equipo</Button>}
        />
      ) : (
        <div className="card-grid">
          {teams.map((team) => (
            <Link key={team._id} href={`/teams/${team._id}`} className="card interactive stack">
              <div className="row">
                <Avatar src={team.shieldUrl} name={team.name} size={64} square />
                <div className="grow">
                  <h3 className="truncate">{team.name}</h3>
                  <p className="text-secondary">{team.playerCount ?? 0} jugadores</p>
                </div>
              </div>
              <p className="text-secondary text-small truncate">Delegado: {team.delegateName || "Sin asignar"}</p>
              {!team.active && <Badge tone="neutral">Inactivo</Badge>}
            </Link>
          ))}
        </div>
      )}

      <TeamFormModal
        open={formOpen}
        championshipId={championshipId}
        team={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </>
  );
}

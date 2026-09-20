"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { RegistrationFormModal } from "@/components/team/RegistrationFormModal";
import { TeamFormModal } from "@/components/team/TeamFormModal";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { REGISTRATION_STATUS_LABEL } from "@/lib/labels";
import type { RosterEntryDTO, TeamDTO } from "@/types/api";

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const team = useFetch<TeamDTO>(`/teams/${id}`);
  const roster = useFetch<{ data: RosterEntryDTO[] }>(`/teams/${id}/roster`);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RosterEntryDTO | null>(null);

  if (team.error) return <ErrorState message={team.error.message} onRetry={team.reload} />;
  if (!team.data) return <Loading />;
  const current = team.data;
  const entries = roster.data?.data ?? [];

  async function handleDelete() {
    setDeleting(true);
    try {
      await http(`/teams/${id}`, { method: "DELETE" });
      toast.success("Equipo eliminado");
      router.push("/teams");
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const reloadAll = () => {
    team.reload();
    roster.reload();
  };

  return (
    <>
      <PageHeader
        title={current.name}
        breadcrumb={[{ label: "Equipos", href: "/teams" }, { label: current.name }]}
        actions={
          <>
            <Link href={`/players/new?teamId=${id}`} className="btn primary"><UserPlus size={18} aria-hidden /> Agregar jugador</Link>
            <Button variant="secondary" icon={<Pencil size={18} />} onClick={() => setEditOpen(true)}>Editar</Button>
            <Button variant="ghost" icon={<Trash2 size={18} />} onClick={() => setDeleteOpen(true)} aria-label="Eliminar equipo" />
          </>
        }
      />

      <section className="card row" style={{ marginBottom: "var(--space-2xl)" }}>
        <Avatar src={current.shieldUrl} name={current.name} size={80} square />
        <div className="stack-sm">
          <div className="row-wrap">
            <span className="text-strong">{current.playerCount ?? 0} jugadores</span>
            {!current.active && <Badge tone="neutral">Inactivo</Badge>}
          </div>
          <span className="text-secondary">Delegado: {current.delegateName || "Sin asignar"}</span>
        </div>
      </section>

      <h2 style={{ marginBottom: "var(--space-md)" }}>Nómina</h2>
      {roster.error ? (
        <ErrorState message={roster.error.message} onRetry={roster.reload} />
      ) : roster.loading && !roster.data ? (
        <Loading />
      ) : entries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={28} />}
            title="Este equipo aún no tiene jugadores"
            description="Registra jugadores para armar la nómina."
            action={<Link href={`/players/new?teamId=${id}`} className="btn primary">Agregar jugador</Link>}
          />
        </div>
      ) : (
        <div className="card flush">
          <div className="table-wrap only-desktop">
            <table className="table">
              <thead>
                <tr><th>Jugador</th><th>Número</th><th>Posición</th><th>Estado</th><th aria-label="Acciones" /></tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry._id}>
                    <td>
                      <Link href={`/players/${entry.playerId._id}`} className="row">
                        <Avatar src={entry.playerId.photoUrl} name={entry.playerId.fullName} size={40} />
                        <span className="text-strong">{entry.playerId.fullName}</span>
                      </Link>
                    </td>
                    <td>#{entry.shirtNumber}</td>
                    <td>{entry.position}</td>
                    <td><StatusBadge status={entry.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      <Button variant="ghost" size="small" onClick={() => setEditingEntry(entry)}>Editar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="only-mobile">
            {entries.map((entry) => (
              <div key={entry._id} className="list-row">
                <Link href={`/players/${entry.playerId._id}`} className="row grow">
                  <Avatar src={entry.playerId.photoUrl} name={entry.playerId.fullName} size={48} />
                  <div className="grow">
                    <div className="text-strong truncate">#{entry.shirtNumber} · {entry.playerId.fullName}</div>
                    <div className="text-secondary text-small">{entry.position}</div>
                    <StatusBadge status={entry.status} />
                  </div>
                </Link>
                <button className="icon-button" onClick={() => setEditingEntry(entry)} aria-label={`Editar inscripción de ${entry.playerId.fullName}`}>
                  <Pencil size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <TeamFormModal
        open={editOpen}
        championshipId={current.championshipId}
        team={current}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          reloadAll();
        }}
      />
      {editingEntry && (
        <RegistrationFormModal
          open
          registrationId={editingEntry._id}
          playerName={editingEntry.playerId.fullName}
          initial={{ shirtNumber: editingEntry.shirtNumber, position: editingEntry.position, status: editingEntry.status }}
          onClose={() => setEditingEntry(null)}
          onSaved={() => {
            setEditingEntry(null);
            reloadAll();
          }}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar equipo"
        message={`¿Eliminar "${current.name}"? Si tiene jugadores o partidos, desactívalo en lugar de eliminarlo.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

function StatusBadge({ status }: { status: RosterEntryDTO["status"] }) {
  const { label, tone } = REGISTRATION_STATUS_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}

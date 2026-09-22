"use client";

import React, { useState } from "react";
import { Clock, Crown, Trash2, UserPlus } from "lucide-react";
import { Avatar, Button, ErrorState, Input, Loading, useToast } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import type { ChampionshipOrganizersDTO } from "@/types/api";

/** Who organizes the championship: the owner, co-organizers, and pending invites by email. */
export function OrganizersManager({ championshipId }: { championshipId: string }) {
  const { data, error, reload } = useFetch<ChampionshipOrganizersDTO>(`/championships/${championshipId}/organizers`);
  const { user } = useRole();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setInviting(true);
    try {
      await http(`/championships/${championshipId}/organizers`, { json: { email: email.trim() } });
      toast.success(`Invitación enviada a ${email.trim()}`);
      setEmail("");
      reload();
    } catch (err) {
      if (err instanceof HttpError) setFormError(err.message);
      else setFormError(errorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  async function remove(idOrEmail: string, label: string) {
    setRemoving(idOrEmail);
    try {
      await http(`/championships/${championshipId}/organizers/${encodeURIComponent(idOrEmail)}`, { method: "DELETE" });
      toast.success(`${label}: ya no organiza este campeonato`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoving(null);
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <div className="stack">
      <p className="text-secondary">Quien organiza puede configurar fases, calendario, equipos, jugadores y sanciones de este campeonato. Invita a otra persona por su correo de Gmail; queda pendiente hasta que inicie sesión.</p>

      <div className="flush-list">
        <h2 className="band band-muted band-small">Organizadores</h2>
        {data.owner && (
          <div className="list-row">
            <Avatar src={data.owner.image} name={data.owner.name} size={40} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="text-strong truncate">{data.owner.name}{data.owner.id === user?.id && " (tú)"}</div>
              <div className="text-secondary text-small truncate">{data.owner.email}</div>
            </div>
            <span className="row text-secondary text-small" style={{ gap: 4 }}><Crown size={16} aria-hidden /> Dueño</span>
          </div>
        )}
        {data.organizers.map((organizer) => (
          <div key={organizer.id} className="list-row">
            <Avatar src={organizer.image} name={organizer.name} size={40} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="text-strong truncate">{organizer.name}{organizer.id === user?.id && " (tú)"}</div>
              <div className="text-secondary text-small truncate">{organizer.email}</div>
            </div>
            <button className="icon-button" aria-label={`Quitar a ${organizer.name}`} disabled={removing === organizer.id} onClick={() => remove(organizer.id, organizer.name)}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {data.invited.map((invitedEmail) => (
          <div key={invitedEmail} className="list-row">
            <span className="attention-icon todo" aria-hidden><Clock size={18} /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="text-strong truncate">{invitedEmail}</div>
              <div className="text-secondary text-small">Invitado: falta que inicie sesión</div>
            </div>
            <button className="icon-button" aria-label={`Cancelar invitación a ${invitedEmail}`} disabled={removing === invitedEmail} onClick={() => remove(invitedEmail, invitedEmail)}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={invite} className="row" style={{ alignItems: "flex-end" }}>
        <div className="grow">
          <Input label="Invitar por correo" type="email" placeholder="nombre@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} error={formError} />
        </div>
        <Button type="submit" icon={<UserPlus size={18} />} loading={inviting}>Invitar</Button>
      </form>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Loading, Modal, Select, useToast } from "@/components/ui";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/client/datetime";
import { useFetch } from "@/lib/client/useFetch";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO, Paginated, TeamDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  /** Match being edited; null creates a new one. */
  match: MatchDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MatchFormModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title={props.match ? "Editar partido" : "Nuevo partido"} onClose={props.onClose}>
      <MatchForm key={props.match?._id ?? "new"} {...props} />
    </Modal>
  );
}

function MatchForm({ championshipId, match, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(match ? null : `/teams?championshipId=${championshipId}&active=true&limit=100`);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocal(match?.scheduledAt));
  const [venue, setVenue] = useState(match?.venue ?? "");
  const [round, setRound] = useState(match?.round ?? "");
  const [status, setStatus] = useState<MatchStatus>(match?.status ?? "scheduled");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!match && !homeTeamId) next.homeTeamId = "Selecciona el equipo local";
    if (!match && !awayTeamId) next.awayTeamId = "Selecciona el equipo visitante";
    if (homeTeamId && homeTeamId === awayTeamId) next.awayTeamId = "El equipo local y el visitante deben ser distintos";
    if (!scheduledAt) next.scheduledAt = "Este campo es obligatorio";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      if (match) {
        await http(`/matches/${match._id}`, {
          method: "PATCH",
          json: {
            scheduledAt: fromDateTimeLocal(scheduledAt),
            venue: venue.trim(),
            round: round.trim(),
            ...(match.status === "live" || match.status === "finished" ? {} : { status }),
          },
        });
      } else {
        await http("/matches", {
          json: {
            championshipId, homeTeamId, awayTeamId,
            scheduledAt: fromDateTimeLocal(scheduledAt),
            venue: venue.trim(),
            round: round.trim(),
          },
        });
      }
      toast.success(match ? "Partido actualizado" : "Partido creado correctamente");
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const teamOptions = teams.data?.data ?? [];
  if (!match && teams.loading && !teams.data) return <Loading />;

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      {!match && (
        <div className="form-grid two">
          <Select label="Equipo local" required value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} error={errors.homeTeamId}>
            <option value="">Selecciona un equipo</option>
            {teamOptions.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
          </Select>
          <Select label="Equipo visitante" required value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} error={errors.awayTeamId}>
            <option value="">Selecciona un equipo</option>
            {teamOptions.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
          </Select>
        </div>
      )}
      <Input label="Fecha y hora" required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} error={errors.scheduledAt} />
      <div className="form-grid two">
        <Input label="Cancha" value={venue} onChange={(e) => setVenue(e.target.value)} error={errors.venue} />
        <Input label="Jornada" value={round} onChange={(e) => setRound(e.target.value)} error={errors.round} />
      </div>
      {match && match.status !== "live" && match.status !== "finished" && (
        <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as MatchStatus)} hint="El inicio y el cierre se gestionan desde la pestaña Eventos.">
          {MATCH_STATUSES.filter((item) => item !== "live" && item !== "finished").map((item) => <option key={item} value={item}>{MATCH_STATUS_LABEL[item].label}</option>)}
        </Select>
      )}
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>{match ? "Guardar cambios" : "Crear partido"}</Button>
      </div>
    </form>
  );
}

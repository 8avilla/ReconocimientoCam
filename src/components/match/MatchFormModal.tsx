"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button, Input, Loading, Modal, Select, useToast } from "@/components/ui";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/client/datetime";
import { useFetch } from "@/lib/client/useFetch";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchDTO, MatchdayDTO, Paginated, PhaseDTO, TeamDTO } from "@/types/api";

interface Props {
  open: boolean;
  championshipId: string;
  phases?: PhaseDTO[];
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

function MatchForm({ championshipId, phases = [], match, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const teams = useFetch<Paginated<TeamDTO>>(match ? null : `/teams?championshipId=${championshipId}&active=true&limit=100`);
  const currentPhase = match?.phaseId && typeof match.phaseId === "object" ? match.phaseId : null;
  // Knockout matches belong to a tie and are managed from the bracket; the others need a phase.
  const inKnockout = currentPhase?.type === "knockout";
  const eligiblePhases = phases.filter((item) => item.type !== "knockout");

  const [phaseId, setPhaseId] = useState(currentPhase?._id ?? (eligiblePhases.length === 1 ? eligiblePhases[0]._id : ""));
  const [group, setGroup] = useState(match?.group ?? "");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocal(match?.scheduledAt));
  const [venue, setVenue] = useState(match?.venue ?? "");
  const [matchdayId, setMatchdayId] = useState(match?.matchdayId?._id ?? "");
  const [status, setStatus] = useState<MatchStatus>(match?.status ?? "scheduled");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPhase = phases.find((item) => item._id === phaseId);
  const matchdays = useFetch<{ data: MatchdayDTO[] }>(inKnockout || !phaseId ? null : `/phases/${phaseId}/matchdays`);
  const isGroups = selectedPhase?.type === "groups";
  // Only the teams of the phase (and of the chosen group) can play in it.
  const allowedIds = new Set(isGroups ? selectedPhase.groups.find((item) => item.name === group)?.teamIds ?? [] : selectedPhase?.teamIds ?? []);
  const teamOptions = (teams.data?.data ?? []).filter((team) => allowedIds.has(team._id));

  const [creatingMatchday, setCreatingMatchday] = useState(false);

  /** Creates the next matchday ("Fecha N") of the chosen phase and selects it. */
  async function createMatchday() {
    setCreatingMatchday(true);
    try {
      const created = await http<{ _id: string }>(`/phases/${phaseId}/matchdays`, { json: {} });
      matchdays.reload();
      setMatchdayId(created._id);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setCreatingMatchday(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!inKnockout && !phaseId) next.phaseId = "Selecciona la fase del partido";
    if (!inKnockout && isGroups && !group) next.group = "Selecciona un grupo";
    if (!inKnockout && !matchdayId) next.matchdayId = "Selecciona la fecha del partido";
    if (!match && !homeTeamId) next.homeTeamId = "Selecciona el equipo local";
    if (!match && !awayTeamId) next.awayTeamId = "Selecciona el equipo visitante";
    if (homeTeamId && homeTeamId === awayTeamId) next.awayTeamId = "El equipo local y el visitante deben ser distintos";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      if (match) {
        await http(`/matches/${match._id}`, {
          method: "PATCH",
          json: {
            scheduledAt: scheduledAt ? fromDateTimeLocal(scheduledAt) : null,
            venue: venue.trim(),
            ...(inKnockout ? {} : { matchdayId, group: isGroups ? group : null }),
            ...(match.status === "live" || match.status === "finished" ? {} : { status }),
          },
        });
      } else {
        await http("/matches", {
          json: {
            matchdayId, homeTeamId, awayTeamId,
            ...(scheduledAt ? { scheduledAt: fromDateTimeLocal(scheduledAt) } : {}),
            venue: venue.trim(),
            ...(isGroups ? { group } : {}),
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

  if (!match && teams.loading && !teams.data) return <Loading />;
  if (!match && eligiblePhases.length === 0) {
    return (
      <div className="stack">
        <div className="alert warning" role="note">
          <AlertCircle size={18} /> Todo partido pertenece a una fase. Crea (o configura) una fase de liga o grupos en el campeonato antes de agregar partidos.
        </div>
        <div className="action-bar">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Link href={`/championships/${championshipId}`} className="btn primary">Configurar fases</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}
      {inKnockout ? (
        <p className="text-secondary">Partido de la eliminatoria «{currentPhase?.name}»: su fase y sus equipos se definen en los cruces.</p>
      ) : (
        <div className="form-grid two">
          <Select label="Fase" required value={phaseId} onChange={(e) => { setPhaseId(e.target.value); setGroup(""); setMatchdayId(""); setHomeTeamId(""); setAwayTeamId(""); }} error={errors.phaseId}>
            <option value="">Selecciona una fase</option>
            {eligiblePhases.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </Select>
          {isGroups && (
            <Select label="Grupo" required value={group} onChange={(e) => { setGroup(e.target.value); setHomeTeamId(""); setAwayTeamId(""); }} error={errors.group}>
              <option value="">Selecciona un grupo</option>
              {selectedPhase.groups.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </Select>
          )}
        </div>
      )}
      {!inKnockout && (
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="grow">
            <Select label="Fecha" required value={matchdayId} disabled={!phaseId} onChange={(e) => setMatchdayId(e.target.value)} error={errors.matchdayId} hint={!phaseId ? "Elige primero la fase." : undefined}>
              <option value="">Selecciona una fecha</option>
              {(matchdays.data?.data ?? []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>
          </div>
          <Button variant="secondary" disabled={!phaseId} loading={creatingMatchday} onClick={createMatchday}>Nueva fecha</Button>
        </div>
      )}
      {!match && (
        <div className="form-grid two">
          <Select label="Equipo local" required value={homeTeamId} disabled={!selectedPhase || (isGroups && !group)} onChange={(e) => setHomeTeamId(e.target.value)} error={errors.homeTeamId} hint={!selectedPhase ? "Elige primero la fase." : undefined}>
            <option value="">Selecciona un equipo</option>
            {teamOptions.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
          </Select>
          <Select label="Equipo visitante" required value={awayTeamId} disabled={!selectedPhase || (isGroups && !group)} onChange={(e) => setAwayTeamId(e.target.value)} error={errors.awayTeamId}>
            <option value="">Selecciona un equipo</option>
            {teamOptions.filter((team) => team._id !== homeTeamId).map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
          </Select>
        </div>
      )}
      <Input label="Día y hora (opcional)" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} error={errors.scheduledAt} hint="Puedes dejarlo vacío y programarlo después; también puedes cambiarlo cuando quieras." />
      <Input label="Cancha" value={venue} onChange={(e) => setVenue(e.target.value)} error={errors.venue} />
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

"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Avatar, Button, Input, Modal, Select, useToast } from "@/components/ui";
import { MATCH_EVENT_TYPES, type MatchEventType } from "@/lib/constants";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { EVENT_TYPE_LABEL, SUSPENSION_REASON_LABEL } from "@/lib/labels";
import { EventIcon } from "./EventIcon";
import type { EventCreateResultDTO } from "@/types/api";

export interface PresentPlayer {
  playerId: string;
  teamId: string;
  fullName: string;
  shirtNumber: number | null;
}

interface Team {
  _id: string;
  name: string;
  shieldUrl: string;
}

interface Props {
  open: boolean;
  matchId: string;
  teams: [Team, Team];
  /** Players checked in as present. */
  players: PresentPlayer[];
  /** Players already sent off: they cannot take part in new events. */
  sentOff: Set<string>;
  initialType: MatchEventType;
  defaultMinute: number;
  onClose: () => void;
  onSaved: () => void;
}

export function EventComposerModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Registrar evento" onClose={props.onClose} wide>
      <Composer {...props} />
    </Modal>
  );
}

const PLAYER_LABEL: Partial<Record<MatchEventType, string>> = {
  goal: "Anotador",
  penalty_goal: "Anotador",
  own_goal: "Jugador que marcó en propia meta",
  penalty_missed: "Ejecutor",
  substitution: "Sale",
};

function Composer({ matchId, teams, players, sentOff, initialType, defaultMinute, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [type, setType] = useState<MatchEventType>(initialType);
  const [teamId, setTeamId] = useState(teams[0]._id);
  const [playerId, setPlayerId] = useState("");
  const [relatedPlayerId, setRelatedPlayerId] = useState("");
  const [minute, setMinute] = useState(String(defaultMinute));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const teamPlayers = players
    .filter((player) => player.teamId === teamId && !sentOff.has(player.playerId))
    .sort((a, b) => (a.shirtNumber ?? 0) - (b.shirtNumber ?? 0));
  const option = (player: PresentPlayer) => (
    <option key={player.playerId} value={player.playerId}>#{player.shirtNumber} · {player.fullName}</option>
  );
  const isIncident = type === "incident";
  const isGoal = type === "goal" || type === "penalty_goal";
  const isSubstitution = type === "substitution";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const next: Record<string, string> = {};
    if (!isIncident && !playerId) next.playerId = "Selecciona al jugador";
    if (isSubstitution && !relatedPlayerId) next.relatedPlayerId = "Selecciona al jugador que entra";
    if (isIncident && !note.trim()) next.note = "Describe el incidente";
    if (minute === "" || Number(minute) < 0 || Number(minute) > 150) next.minute = "El minuto no es válido";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const result = await http<EventCreateResultDTO>(`/matches/${matchId}/events`, {
        json: {
          type,
          teamId,
          playerId: isIncident ? undefined : playerId,
          relatedPlayerId: (isGoal || isSubstitution) && relatedPlayerId ? relatedPlayerId : undefined,
          minute: Number(minute),
          note: note.trim() || undefined,
        },
      });
      toast.success(`Evento registrado (${EVENT_TYPE_LABEL[type].toLowerCase()}) · marcador ${result.score.home} – ${result.score.away}`);
      if (result.autoEvents.length > 0) toast.error("Doble amarilla: expulsión automática");
      for (const suspension of result.suspensions) toast.error(`Suspensión generada: ${SUSPENSION_REASON_LABEL[suspension.reason]}`);
      onSaved();
    } catch (error) {
      if (error instanceof HttpError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {formError && <div className="alert error" role="alert"><AlertCircle size={18} /> {formError}</div>}

      <div className="row-wrap" role="radiogroup" aria-label="Tipo de evento">
        {MATCH_EVENT_TYPES.map((item) => (
          <Button
            key={item} size="small" role="radio" aria-checked={type === item} variant={type === item ? "primary" : "secondary"}
            icon={<EventIcon type={item} size={16} />} onClick={() => { setType(item); setErrors({}); }}
          >
            {EVENT_TYPE_LABEL[item]}
          </Button>
        ))}
      </div>

      <div className="form-grid two" role="radiogroup" aria-label="Equipo">
        {teams.map((team) => (
          <Button
            key={team._id} size="large" role="radio" aria-checked={teamId === team._id} variant={teamId === team._id ? "primary" : "secondary"}
            onClick={() => { setTeamId(team._id); setPlayerId(""); setRelatedPlayerId(""); }}
          >
            <Avatar src={team.shieldUrl} name={team.name} size={24} square /> {team.name}
          </Button>
        ))}
      </div>

      {!isIncident && (
        <Select label={PLAYER_LABEL[type] ?? "Jugador"} required value={playerId} onChange={(e) => setPlayerId(e.target.value)} error={errors.playerId}>
          <option value="">Selecciona un jugador</option>
          {teamPlayers.map(option)}
        </Select>
      )}
      {isGoal && (
        <Select label="Asistencia (opcional)" value={relatedPlayerId} onChange={(e) => setRelatedPlayerId(e.target.value)} error={errors.relatedPlayerId}>
          <option value="">Sin asistencia</option>
          {teamPlayers.filter((player) => player.playerId !== playerId).map(option)}
        </Select>
      )}
      {isSubstitution && (
        <Select label="Entra" required value={relatedPlayerId} onChange={(e) => setRelatedPlayerId(e.target.value)} error={errors.relatedPlayerId}>
          <option value="">Selecciona un jugador</option>
          {teamPlayers.filter((player) => player.playerId !== playerId).map(option)}
        </Select>
      )}

      <div className="form-grid two">
        <Input label="Minuto" required type="number" min={0} max={150} inputMode="numeric" value={minute} onChange={(e) => setMinute(e.target.value)} error={errors.minute} />
        <Input label={isIncident ? "Descripción" : "Nota (opcional)"} required={isIncident} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
      </div>

      {teamPlayers.length === 0 && !isIncident && (
        <div className="alert warning" role="note">
          <AlertCircle size={18} /> No hay jugadores presentes de este equipo. Registra su asistencia primero.
        </div>
      )}

      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" size="large" loading={saving}>Registrar {EVENT_TYPE_LABEL[type].toLowerCase()}</Button>
      </div>
    </form>
  );
}

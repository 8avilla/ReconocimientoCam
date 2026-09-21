"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarPlus, Check, Lightbulb } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { Avatar, Badge, Button, Input, Modal, Select, useToast } from "@/components/ui";
import { errorMessage, http, HttpError } from "@/lib/client/http";
import { fromDateTimeLocal } from "@/lib/client/datetime";
import { formatDateTime, MATCH_STATUS_LABEL } from "@/lib/labels";
import type { MatchStatus } from "@/lib/constants";
import type { BracketRoundDTO, BracketTieDTO } from "@/types/api";

interface Props {
  tie: BracketTieDTO;
  round: BracketRoundDTO;
  onChanged: () => void;
}

/** One matchup: its teams, matches, aggregate score and the organizer's decision on who advances. */
export function TieCard({ tie, round, onChanged }: Props) {
  const toast = useToast();
  const manage = useRole().can("championship.manage");
  const [busy, setBusy] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  async function decide(teamId: string | null) {
    setBusy(true);
    try {
      await http(`/ties/${tie._id}/winner`, { method: "PATCH", json: { teamId } });
      toast.success(teamId ? "Ganador definido" : "Ganador borrado");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const teams = [tie.homeTeam, tie.awayTeam];
  const usedLegs = new Set(tie.matches.map((match) => match.leg));
  const canAddMatch = !tie.bye && usedLegs.size < round.legs;
  const suggested = tie.suggestedWinnerTeamId && !tie.winnerTeamId ? teams.find((team) => team?._id === tie.suggestedWinnerTeamId) : null;

  return (
    <article className="card stack-sm" aria-label={`Cruce ${tie.position}`}>
      <div className="text-secondary text-small">Cruce {tie.position}</div>
      {teams.map((team, index) =>
        team ? (
          <div key={team._id} className="row" style={{ fontWeight: tie.winnerTeamId === team._id ? 700 : 500 }}>
            <Avatar src={team.shieldUrl} name={team.name} size={32} square />
            <span className="grow truncate">{team.name}</span>
            {tie.aggregate && tie.aggregate.played > 0 && <span className="text-strong" aria-label="Global">{index === 0 ? tie.aggregate.home : tie.aggregate.away}</span>}
            {tie.winnerTeamId === team._id && <Badge tone="success" icon={<Check size={12} aria-hidden />}>Avanza</Badge>}
          </div>
        ) : null
      )}
      {tie.bye && <p className="text-secondary text-small">Descansa: avanza sin jugar.</p>}

      {tie.matches.length > 0 && (
        <ul className="stack-sm" style={{ listStyle: "none" }} aria-label="Partidos del cruce">
          {tie.matches.map((match) => (
            <li key={match._id}>
              <Link href={`/matches/${match._id}`} className="row-between text-small" style={{ gap: "var(--space-sm)" }}>
                <span className="text-secondary">{round.legs === 2 ? (match.leg === 1 ? "Ida" : "Vuelta") : "Partido"} · {formatDateTime(match.scheduledAt)}</span>
                <span className="text-strong">
                  {match.status === "scheduled" ? MATCH_STATUS_LABEL[match.status as MatchStatus].label : `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {manage && suggested && (
        <div className="alert info" role="note">
          <Lightbulb size={18} aria-hidden />
          <span className="grow">Según el resultado avanzaría <strong>{suggested.name}</strong>.</span>
          <Button size="small" variant="secondary" loading={busy} onClick={() => decide(suggested._id)}>Aceptar</Button>
        </div>
      )}

      {manage && !tie.bye && tie.homeTeam && tie.awayTeam && (
        <div className="row-wrap" role="group" aria-label="Quién avanza">
          {[tie.homeTeam, tie.awayTeam].map((team) => (
            <Button key={team._id} size="small" variant={tie.winnerTeamId === team._id ? "primary" : "secondary"} aria-pressed={tie.winnerTeamId === team._id} loading={busy} onClick={() => decide(tie.winnerTeamId === team._id ? null : team._id)}>
              Avanza {team.name}
            </Button>
          ))}
        </div>
      )}
      {manage && canAddMatch && <div><Button variant="ghost" size="small" icon={<CalendarPlus size={16} />} onClick={() => setMatchOpen(true)}>Agregar partido</Button></div>}

      <TieMatchModal open={matchOpen} tie={tie} round={round} usedLegs={usedLegs} onClose={() => setMatchOpen(false)} onSaved={() => { setMatchOpen(false); onChanged(); }} />
    </article>
  );
}

function TieMatchModal({ open, ...props }: { open: boolean; tie: BracketTieDTO; round: BracketRoundDTO; usedLegs: Set<number>; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal open={open} title={`Agregar partido · ${props.round.name}`} onClose={props.onClose}>
      <TieMatchForm {...props} />
    </Modal>
  );
}

function TieMatchForm({ tie, round, usedLegs, onClose, onSaved }: { tie: BracketTieDTO; round: BracketRoundDTO; usedLegs: Set<number>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const freeLegs = ([1, 2] as const).filter((leg) => leg <= round.legs && !usedLegs.has(leg));
  const [leg, setLeg] = useState<number>(freeLegs[0] ?? 1);
  const [scheduledAt, setScheduledAt] = useState("");
  const [venue, setVenue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await http(`/ties/${tie._id}/matches`, { json: { leg, ...(scheduledAt ? { scheduledAt: fromDateTimeLocal(scheduledAt) } : {}), venue: venue.trim() || undefined } });
      toast.success("Partido creado");
      onSaved();
    } catch (err) {
      setError(err instanceof HttpError && Object.keys(err.fieldErrors).length > 0 ? Object.values(err.fieldErrors)[0] : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const home = leg === 1 ? tie.homeTeam : tie.awayTeam;
  const away = leg === 1 ? tie.awayTeam : tie.homeTeam;
  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      {round.legs === 2 && (
        <Select label="Partido" value={leg} onChange={(e) => setLeg(Number(e.target.value))}>
          {freeLegs.map((item) => <option key={item} value={item}>{item === 1 ? "Ida" : "Vuelta"}</option>)}
        </Select>
      )}
      <p className="text-secondary">{home?.name} vs {away?.name}</p>
      <Input label="Día y hora (opcional)" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} hint="Puedes programarlo después." />
      <Input label="Cancha (opcional)" value={venue} onChange={(e) => setVenue(e.target.value)} />
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Crear partido</Button>
      </div>
    </form>
  );
}

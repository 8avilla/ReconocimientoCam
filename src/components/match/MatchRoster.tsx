"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeftRight, Ellipsis, Search } from "lucide-react";
import { Avatar, Button, useToast } from "@/components/ui";
import type { MatchEventType } from "@/lib/constants";
import { errorMessage, http } from "@/lib/client/http";
import { EVENT_TYPE_LABEL, MATCH_PERIOD_LABEL, SUSPENSION_REASON_LABEL } from "@/lib/labels";
import { suggestedMinute } from "@/lib/rules/match";
import { EventIcon } from "./EventIcon";
import type { PresentPlayer } from "./EventComposerModal";
import type { EventCreateResultDTO, MatchDTO, MatchEventDTO } from "@/types/api";

type QuickType = "goal" | "yellow_card" | "red_card";
const QUICK: QuickType[] = ["goal", "yellow_card", "red_card"];

interface Props {
  match: MatchDTO;
  events: MatchEventDTO[];
  /** Both squads' active roster; check-in status is informational only, never a requirement to tag someone. */
  players: PresentPlayer[];
  sentOff: Set<string>;
  onChanged: () => void;
  /** Opens the detailed form for events that need more data (substitution, own goal, incident...). */
  onOther: (type: MatchEventType) => void;
  onGoToAttendance: () => void;
}

/**
 * Both squads' full roster (not just checked-in players) with one counter per goal / yellow / red: one tap
 * registers the event at the current match minute and the toast offers to undo it. The events are the same
 * ones the detailed form creates, so the timeline, discipline and suspensions keep working.
 */
export function MatchRoster({ match, events, players, sentOff, onChanged, onOther, onGoToAttendance }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Long press on a counter takes one event away; the click that follows a long press must not add one back.
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  const [now, setNow] = useState(() => Date.now());
  const playing = match.status === "live" && (match.period === "first_half" || match.period === "second_half");
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [playing]);

  const count = (playerId: string, type: QuickType) =>
    events.filter((event) => !event.voided && event.playerId?._id === playerId && (type === "goal" ? event.type === "goal" || event.type === "penalty_goal" : event.type === type)).length;

  async function undo(eventId: string) {
    try {
      await http(`/matches/${match._id}/events/${eventId}/void`, { method: "POST" });
      toast.success("Evento anulado");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /** Voids the latest event of that kind for the player (the automatic red card can only go with its second yellow). */
  async function removeLast(player: PresentPlayer, type: QuickType) {
    const kinds = type === "goal" ? ["goal", "penalty_goal"] : [type];
    const last = [...events].reverse().find((event) => !event.voided && event.playerId?._id === player.playerId && kinds.includes(event.type) && !event.auto);
    if (!last) {
      toast.error(count(player.playerId, type) > 0 ? "La roja automática se quita anulando la segunda amarilla" : `${player.fullName} no tiene ${EVENT_TYPE_LABEL[type].toLowerCase()} para quitar`);
      return;
    }
    setBusy(`${player.playerId}:${type}`);
    try {
      await http(`/matches/${match._id}/events/${last._id}/void`, { method: "POST" });
      toast.success(`Se quitó ${EVENT_TYPE_LABEL[type].toLowerCase()} · ${player.fullName}`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const startPress = (player: PresentPlayer, type: QuickType) => {
    press.current.fired = false;
    press.current.timer = setTimeout(() => {
      press.current.fired = true;
      removeLast(player, type);
    }, 550);
  };
  const cancelPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };

  async function register(player: PresentPlayer, type: QuickType) {
    const key = `${player.playerId}:${type}`;
    setBusy(key);
    try {
      const result = await http<EventCreateResultDTO>(`/matches/${match._id}/events`, {
        json: { type, teamId: player.teamId, playerId: player.playerId, minute: suggestedMinute(match.period, match.periodStartedAt) },
      });
      toast.success(`${EVENT_TYPE_LABEL[type]} · ${player.fullName} · ${result.score.home} – ${result.score.away}`, { label: "Deshacer", onClick: () => undo(result.event._id) });
      if (result.autoEvents.length > 0) toast.error("Doble amarilla: expulsión automática");
      for (const suspension of result.suspensions) toast.error(`Suspensión generada: ${SUSPENSION_REASON_LABEL[suspension.reason]}`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  /** Adds a goal straight to the scoreboard, with no scorer: the fastest way to correct or bump the score. */
  async function bumpGoal(teamId: string) {
    const key = `${teamId}:score+`;
    setBusy(key);
    try {
      const result = await http<EventCreateResultDTO>(`/matches/${match._id}/events`, {
        json: { type: "goal", teamId, minute: suggestedMinute(match.period, match.periodStartedAt) },
      });
      toast.success(`Gol · ${result.score.home} – ${result.score.away}`, { label: "Deshacer", onClick: () => undo(result.event._id) });
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  /** Voids that team's most recent goal, whoever it was credited to (own goals count for the other team). */
  async function undoLastGoal(teamId: string) {
    const otherTeamId = teamId === match.homeTeamId._id ? match.awayTeamId._id : match.homeTeamId._id;
    const last = [...events].reverse().find((event) => {
      if (event.voided) return false;
      if (event.type === "goal" || event.type === "penalty_goal") return event.teamId === teamId;
      if (event.type === "own_goal") return event.teamId === otherTeamId;
      return false;
    });
    if (!last) {
      toast.error("Este equipo no tiene goles para quitar");
      return;
    }
    const key = `${teamId}:score-`;
    setBusy(key);
    try {
      await http(`/matches/${match._id}/events/${last._id}/void`, { method: "POST" });
      toast.success("Gol anulado");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const teams = [match.homeTeamId, match.awayTeamId];
  const term = search.trim().toLowerCase();
  const score = { [match.homeTeamId._id]: match.homeScore ?? 0, [match.awayTeamId._id]: match.awayScore ?? 0 };

  return (
    <section className="stack" aria-label="Registrar eventos">
      <div className="row-between">
        <h2>Registrar eventos</h2>
        <div className="row">
          <Button variant="secondary" size="small" icon={<ArrowLeftRight size={16} />} onClick={() => onOther("substitution")}>Cambio</Button>
          <Button variant="ghost" size="small" icon={<Ellipsis size={16} />} onClick={() => onOther("incident")}>Otro</Button>
        </div>
      </div>
      <div className="live-bar" aria-label="Marcador en vivo">
        <span className="truncate">{match.homeTeamId.name}</span>
        <strong>{match.homeScore ?? 0} – {match.awayScore ?? 0}</strong>
        <span className="truncate" style={{ textAlign: "right" }}>{match.awayTeamId.name}</span>
        <span className="live-bar-time">{MATCH_PERIOD_LABEL[match.period]}{playing && ` · ${suggestedMinute(match.period, match.periodStartedAt, new Date(now))}'`}</span>
        <div className="live-bar-goals">
          <div className="live-bar-goal-group">
            <button type="button" className="live-bar-goal-btn" disabled={busy !== null} aria-label={`Quitar gol a ${match.homeTeamId.name}`} onClick={() => undoLastGoal(match.homeTeamId._id)}>−</button>
            <button type="button" className="live-bar-goal-btn" disabled={busy !== null} aria-label={`Sumar gol a ${match.homeTeamId.name} sin anotador`} onClick={() => bumpGoal(match.homeTeamId._id)}>+</button>
          </div>
          <div className="live-bar-goal-group">
            <button type="button" className="live-bar-goal-btn" disabled={busy !== null} aria-label={`Quitar gol a ${match.awayTeamId.name}`} onClick={() => undoLastGoal(match.awayTeamId._id)}>−</button>
            <button type="button" className="live-bar-goal-btn" disabled={busy !== null} aria-label={`Sumar gol a ${match.awayTeamId.name} sin anotador`} onClick={() => bumpGoal(match.awayTeamId._id)}>+</button>
          </div>
        </div>
      </div>
      <p className="text-secondary text-small">Toca un contador para sumar un gol o una tarjeta al minuto actual; mantén pulsado para quitar el último. Los botones +/− del marcador suman o quitan un gol directo, sin anotador. También puedes deshacer desde el aviso o anular en la cronología.</p>
      <div className="search" style={{ maxWidth: 420 }}>
        <Search size={18} aria-hidden />
        <input className="input" type="search" placeholder="Buscar jugador por nombre o número..." aria-label="Buscar jugador" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="form-grid two" style={{ alignItems: "start" }}>
        {teams.map((team) => {
          const squad = players.filter((player) => player.teamId === team._id && (!term || player.fullName.toLowerCase().includes(term) || String(player.shirtNumber ?? "") === term)).sort((a, b) => (a.shirtNumber ?? 0) - (b.shirtNumber ?? 0));
          return (
            <div key={team._id} className="flush-list">
              <div className="row-between match-group-head">
                <div className="row">
                  <Avatar src={team.shieldUrl} name={team.name} size={32} square />
                  <h3>{team.name}</h3>
                </div>
                <span className="text-strong" aria-label={`Goles de ${team.name}`} style={{ fontSize: 20 }}>{score[team._id]}</span>
              </div>
              {squad.length === 0 ? (
                <div className="alert warning" role="note" style={{ margin: "var(--space-md)" }}>
                  <AlertCircle size={18} />
                  <span className="grow">Este equipo no tiene jugadores en su plantilla.</span>
                  <button className="text-strong" onClick={onGoToAttendance}>Ir a asistencia</button>
                </div>
              ) : (
                <ul style={{ listStyle: "none" }}>
                  {squad.map((player) => {
                    const out = sentOff.has(player.playerId);
                    return (
                      <li key={player.playerId} className={`roster-row${out ? " sent-off" : ""}`}>
                        <span className="roster-shirt">{player.shirtNumber ?? "–"}</span>
                        <div className="grow">
                          <div className="truncate text-strong">{player.fullName}</div>
                          {out ? (
                            <div className="text-small" style={{ color: "var(--color-error)" }}>Expulsado</div>
                          ) : player.status && player.status !== "present" ? (
                            <div className="text-small text-secondary">Sin confirmar</div>
                          ) : null}
                        </div>
                        <div className="counters">
                          {QUICK.map((type) => {
                            const total = count(player.playerId, type);
                            return (
                              <button
                                key={type}
                                className={`counter${total > 0 ? " active" : ""}`}
                                disabled={out || busy !== null}
                                aria-label={`${EVENT_TYPE_LABEL[type]} de ${player.fullName}: ${total}. Toca para sumar, mantén pulsado para quitar`}
                                onPointerDown={() => startPress(player, type)}
                                onPointerUp={cancelPress}
                                onPointerLeave={cancelPress}
                                onPointerCancel={cancelPress}
                                onContextMenu={(event) => event.preventDefault()}
                                onClick={() => {
                                  if (press.current.fired) {
                                    press.current.fired = false;
                                    return;
                                  }
                                  register(player, type);
                                }}
                              >
                                <EventIcon type={type} size={18} /> {total}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

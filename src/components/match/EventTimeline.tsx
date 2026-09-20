"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Badge, Button, EmptyState, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { EVENT_TYPE_LABEL } from "@/lib/labels";
import { EventIcon } from "./EventIcon";
import type { MatchEventDTO } from "@/types/api";
import { Clock } from "lucide-react";

interface Props {
  matchId: string;
  events: MatchEventDTO[];
  teamNames: Record<string, string>;
  shirtByPlayer: Record<string, number | null>;
  /** Voiding is only possible while the match is live or finished. */
  canVoid: boolean;
  onChanged: () => void;
}

export function EventTimeline({ matchId, events, teamNames, shirtByPlayer, canVoid, onChanged }: Props) {
  const toast = useToast();
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const who = (player?: MatchEventDTO["playerId"]) =>
    player ? `${shirtByPlayer[player._id] != null ? `#${shirtByPlayer[player._id]} ` : ""}${player.fullName}` : "";

  function describe(event: MatchEventDTO): string {
    const main = who(event.playerId);
    if (event.type === "substitution") return `Sale ${main} · entra ${who(event.relatedPlayerId)}`;
    if (event.type === "incident") return event.note ?? "";
    if (event.relatedPlayerId) return `${main} (asistencia: ${who(event.relatedPlayerId)})`;
    return main;
  }

  /** Voids right away, without confirmation; the event stays in the history as "Anulado". */
  async function voidEvent(event: MatchEventDTO) {
    setVoidingId(event._id);
    try {
      await http(`/matches/${matchId}/events/${event._id}/void`, { method: "POST" });
      toast.success("Evento anulado");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setVoidingId(null);
    }
  }

  if (events.length === 0) {
    return <EmptyState icon={<Clock size={28} />} title="Sin eventos" description="Aquí aparecerán los goles, tarjetas y cambios del partido." />;
  }

  return (
    <>
      <ol style={{ listStyle: "none" }} aria-label="Cronología del partido">
        {events.map((event) => (
          <li key={event._id} className="list-row" style={{ opacity: event.voided ? 0.6 : 1 }}>
            <span className="text-strong" style={{ width: 40, textAlign: "right" }}>{event.minute}&apos;</span>
            <span style={{ width: 28, display: "inline-flex", justifyContent: "center" }}><EventIcon type={event.type} /></span>
            <div className="grow">
              <div style={event.voided ? { textDecoration: "line-through" } : undefined}>
                <span className="text-strong">{EVENT_TYPE_LABEL[event.type]}</span> · {describe(event)}
              </div>
              <div className="text-secondary text-small">
                {teamNames[event.teamId]}
                {event.auto && " · Automática (doble amarilla)"}
                {event.voided && event.voidReason && ` · Anulado: ${event.voidReason}`}
              </div>
            </div>
            {event.voided && <Badge tone="neutral">Anulado</Badge>}
            {canVoid && !event.voided && !event.auto && (
              <Button variant="ghost" size="small" icon={<Undo2 size={16} />} loading={voidingId === event._id} onClick={() => voidEvent(event)} aria-label={`Anular ${EVENT_TYPE_LABEL[event.type]} del minuto ${event.minute}`}>
                Anular
              </Button>
            )}
          </li>
        ))}
      </ol>

    </>
  );
}

import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { Clock } from "lucide-react";
import type { MatchEventType } from "@/lib/constants";
import { MATCH_PERIOD_LABEL } from "@/lib/labels";
import { EventIcon } from "./EventIcon";
import type { MatchEventDTO, SuspensionDTO } from "@/types/api";

interface Team {
  _id: string;
  name: string;
  shieldUrl: string;
}

// What the timeline shows per event; a plain note ("incident") belongs to the full Eventos tab, not this recap.
const TIMELINE_TYPES: MatchEventType[] = ["goal", "penalty_goal", "own_goal", "yellow_card", "red_card", "substitution", "penalty_missed"];
const GOAL_TYPES: MatchEventType[] = ["goal", "penalty_goal", "own_goal"];
const PREFIX_LABEL: Partial<Record<MatchEventType, string>> = { penalty_goal: "(Penalti) ", own_goal: "(Autogol) ", penalty_missed: "(Penal fallado) " };

interface Score {
  home: number;
  away: number;
}

/** Chronological recap of a played match: one row per goal, card or substitution, grouped by half, home
 * team anchored left and away team right (mirrored) — each with its minute and, for a goal, the running
 * score at that point. Minutes aren't split into stoppage time (the app doesn't track that separately),
 * so a first-half goal added on beyond minute 45 reads as part of the second half. */
export function MatchSummary({
  events,
  teams,
  suspensions,
  shirtByPlayer,
}: {
  events: MatchEventDTO[];
  teams: [Team, Team];
  suspensions: SuspensionDTO[];
  shirtByPlayer: Record<string, number | null>;
}) {
  const [home, away] = teams;
  const timeline = events.filter((event) => !event.voided && TIMELINE_TYPES.includes(event.type)).sort((a, b) => a.minute - b.minute);

  const withScore = timeline.reduce<{ event: MatchEventDTO; score: Score }[]>((acc, event) => {
    const previous = acc[acc.length - 1]?.score ?? { home: 0, away: 0 };
    if (!GOAL_TYPES.includes(event.type)) {
      acc.push({ event, score: previous });
      return acc;
    }
    const scoringTeam = event.type === "own_goal" ? (event.teamId === home._id ? away._id : home._id) : event.teamId;
    const score = scoringTeam === home._id ? { home: previous.home + 1, away: previous.away } : { home: previous.home, away: previous.away + 1 };
    acc.push({ event, score });
    return acc;
  }, []);

  const halves = [
    { label: MATCH_PERIOD_LABEL.first_half, items: withScore.filter((item) => item.event.minute <= 45) },
    { label: MATCH_PERIOD_LABEL.second_half, items: withScore.filter((item) => item.event.minute > 45) },
  ].filter((half) => half.items.length > 0);

  const shirt = (playerId: string) => (shirtByPlayer[playerId] != null ? `#${shirtByPlayer[playerId]} ` : "");

  return (
    <div className="stack">
      {halves.length === 0 ? (
        <div className="card"><EmptyState icon={<Clock size={28} />} title="Sin eventos" description="No se registraron goles, tarjetas ni cambios en este partido." /></div>
      ) : (
        <div className="flush-list" aria-label="Cronología">
          {halves.map((half) => {
            const last = half.items[half.items.length - 1];
            return (
              <section key={half.label}>
                <div className="band band-muted band-small row-between">
                  <span>{half.label}</span>
                  <span>{last.score.home} - {last.score.away}</span>
                </div>
                {half.items.map(({ event, score }) => (
                  <EventRow key={event._id} event={event} score={score} home={home} away={away} shirt={shirt} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {suspensions.length > 0 && (
        <section className="card stack-sm" aria-label="Suspendidos">
          <h3>Suspendidos</h3>
          <p>
            {suspensions.map((suspension, index) => (
              <span key={suspension._id}>
                {index > 0 && ", "}
                <Link href={`/players/${suspension.playerId._id}`} className="event-row-name">{suspension.playerId.fullName}</Link>{" "}
                (<Link href={`/teams/${suspension.teamId._id}`}>{suspension.teamId.name}</Link>)
              </span>
            ))}
          </p>
        </section>
      )}
    </div>
  );
}

function EventRow({
  event,
  score,
  home,
  shirt,
}: {
  event: MatchEventDTO;
  score: Score;
  home: Team;
  away: Team;
  shirt: (playerId: string) => string;
}) {
  const isHome = event.teamId === home._id;
  const isGoal = GOAL_TYPES.includes(event.type);
  const prefix = PREFIX_LABEL[event.type];

  return (
    <div className={`event-row${isHome ? "" : " away"}`}>
      <div className="event-row-content">
        <span className="event-row-minute">{event.minute}&apos;</span>
        <EventIcon type={event.type} size={16} />
        {isGoal && <span className="event-row-score">{score.home} - {score.away}</span>}
        {event.type === "substitution" ? (
          <>
            {event.relatedPlayerId && (
              <Link href={`/players/${event.relatedPlayerId._id}`} className="event-row-name truncate">
                {shirt(event.relatedPlayerId._id)}{event.relatedPlayerId.fullName}
              </Link>
            )}
            {event.playerId && (
              <span className="event-row-name text-secondary truncate">{shirt(event.playerId._id)}{event.playerId.fullName}</span>
            )}
          </>
        ) : (
          <Link href={event.playerId ? `/players/${event.playerId._id}` : "#"} className="truncate">
            {prefix && <span className="text-secondary text-small">{prefix}</span>}
            <span className="event-row-name">{event.playerId ? `${shirt(event.playerId._id)}${event.playerId.fullName}` : "Sin anotador"}</span>
            {event.relatedPlayerId && <span className="event-row-name text-secondary"> (asist. {event.relatedPlayerId.fullName})</span>}
          </Link>
        )}
      </div>
    </div>
  );
}

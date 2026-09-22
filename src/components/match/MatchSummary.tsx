import { Avatar } from "@/components/ui";
import type { MatchEventType } from "@/lib/constants";
import { EventIcon } from "./EventIcon";
import type { MatchEventDTO, SuspensionDTO } from "@/types/api";

interface Team {
  _id: string;
  name: string;
  shieldUrl: string;
}

// Only what a lineup report shows per player: goals (including own goals) and cards.
const BADGE_TYPES: MatchEventType[] = ["goal", "penalty_goal", "own_goal", "yellow_card", "red_card"];

interface PlayerLine {
  playerId: string;
  fullName: string;
  shirtNumber: number | null;
  badges: MatchEventType[];
}

/** Lineup-style recap: one row per player with a goal or a card, and an icon for each one they got. */
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
  const valid = events.filter((event) => !event.voided && event.playerId && BADGE_TYPES.includes(event.type));

  function lineup(team: Team): PlayerLine[] {
    const byPlayer = new Map<string, PlayerLine>();
    for (const event of valid) {
      // An own goal counts for the opponent on the scoreboard, but it's still that player's own doing.
      if (event.teamId !== team._id) continue;
      const player = event.playerId!;
      const line = byPlayer.get(player._id) ?? {
        playerId: player._id,
        fullName: player.fullName,
        shirtNumber: shirtByPlayer[player._id] ?? null,
        badges: [],
      };
      line.badges.push(event.type);
      byPlayer.set(player._id, line);
    }
    return [...byPlayer.values()].sort((a, b) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));
  }

  return (
    <div className="stack">
      <section className="card stack" aria-label="Alineación">
        <h3>Alineación</h3>
        <div className="form-grid two" style={{ alignItems: "start" }}>
          {teams.map((team) => {
            const lines = lineup(team);
            return (
              <div key={team._id} className="stack-sm">
                <div className="row"><Avatar src={team.shieldUrl} name={team.name} size={24} square /><span className="text-strong">{team.name}</span></div>
                {lines.length === 0 ? (
                  <p className="text-secondary text-small">Sin goles ni tarjetas</p>
                ) : (
                  <ul style={{ listStyle: "none" }}>
                    {lines.map((line) => (
                      <li key={line.playerId} className="row-between" style={{ padding: "4px 0" }}>
                        <span className="truncate">{line.shirtNumber != null ? `${line.shirtNumber} ` : ""}{line.fullName}</span>
                        <span className="row" style={{ gap: 2, flexShrink: 0 }}>
                          {line.badges.map((type, index) => <EventIcon key={index} type={type} size={16} />)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {suspensions.length > 0 && (
        <section className="card stack-sm" aria-label="Suspendidos">
          <h3>Suspendidos</h3>
          <p>{suspensions.map((suspension) => `${suspension.playerId.fullName} (${suspension.teamId.name})`).join(", ")}</p>
        </section>
      )}
    </div>
  );
}

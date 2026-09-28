import Link from "next/link";
import { Avatar } from "@/components/ui";
import { POSITIONS, type MatchEventType } from "@/lib/constants";
import { EventIcon } from "./EventIcon";
import type { AttendanceRowDTO, MatchEventDTO } from "@/types/api";

interface Team {
  _id: string;
  name: string;
  shieldUrl: string;
}

interface LineupPlayer {
  playerId: string;
  fullName: string;
  photoUrl: string;
  shirtNumber: number | null;
  goalkeeper: boolean;
  badges: MatchEventType[];
}

const POSITION_ORDER = Object.fromEntries(POSITIONS.map((position, index) => [position, index]));
const BADGE_TYPES: MatchEventType[] = ["yellow_card", "red_card", "substitution"];

/** Every called-up player who wasn't marked absent, one column per team (home left, away right, mirrored),
 * goalkeeper first: a card or a substitution they had during the match gets its icon next to their name.
 * Matches how event tagging already treats attendance elsewhere in the app (see `MatchDetail`'s
 * `presentPlayers`): many amateur matches never confirm check-in one way or the other, so "pending" reads
 * as attended too — only an explicit "absent" excludes a player. */
export function MatchLineup({ checkIns, events, teams }: { checkIns: AttendanceRowDTO[]; events: MatchEventDTO[]; teams: [Team, Team] }) {
  const present = checkIns.filter((row) => row.status !== "absent");
  const valid = events.filter((event) => !event.voided && BADGE_TYPES.includes(event.type));

  function lineup(team: Team): LineupPlayer[] {
    return present
      .filter((row) => row.teamId === team._id)
      .sort((a, b) => (POSITION_ORDER[a.position ?? ""] ?? 99) - (POSITION_ORDER[b.position ?? ""] ?? 99) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999))
      .map((row) => ({
        playerId: row.playerId._id,
        fullName: row.playerId.fullName,
        photoUrl: row.playerId.photoUrl,
        shirtNumber: row.shirtNumber,
        goalkeeper: row.position === "Portero",
        // A substitution can list this player either as the one leaving or the one coming on.
        badges: valid
          .filter((event) => event.playerId?._id === row.playerId._id || (event.type === "substitution" && event.relatedPlayerId?._id === row.playerId._id))
          .map((event) => event.type),
      }));
  }

  return (
    <div className="flush-list" aria-label="Alineación">
      <div className="lineup-grid">
        {teams.map((team, index) => {
          const players = lineup(team);
          const away = index === 1;
          return (
            <div key={team._id}>
              {players.length === 0 ? (
                <p className="text-secondary text-small">Sin asistencia registrada</p>
              ) : (
                <ul style={{ listStyle: "none" }}>
                  {players.map((player) => (
                    <li key={player.playerId}>
                      <Link href={`/players/${player.playerId}`} className={`lineup-player${away ? " away" : ""}`}>
                        <span className="lineup-number">{player.shirtNumber ?? ""}</span>
                        <Avatar src={player.photoUrl} name={player.fullName} size={18} square />
                        <span className="truncate">{player.fullName}{player.goalkeeper ? " (G)" : ""}</span>
                        {player.badges.length > 0 && (
                          <span className="lineup-icons">
                            {player.badges.map((type, badgeIndex) => <EventIcon key={badgeIndex} type={type} size={12} />)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

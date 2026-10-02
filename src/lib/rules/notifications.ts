import type { FollowTargetType } from "@/models/Follow";
import type { NotificationKind } from "@/models/Notification";

/**
 * Who hears about what. Following a championship is the broad, quiet level (its calendar and results); a team adds
 * everything that happens to it; a player adds what happens to them.
 */
const AUDIENCE: Record<NotificationKind, FollowTargetType[]> = {
  match_scheduled: ["championship", "team"],
  match_started: ["championship", "team"],
  match_finished: ["championship", "team"],
  goal: ["team", "player"],
  yellow_card: ["team", "player"],
  red_card: ["team", "player"],
  suspension: ["team", "player"],
};

export const audienceTypes = (kind: NotificationKind) => AUDIENCE[kind];

export interface FollowRef {
  userId: string;
  targetType: FollowTargetType;
  targetId: string;
}

/** What the event is about: the championship, its teams and the players involved. */
export interface EventSubjects {
  championshipId: string;
  teamIds: string[];
  playerIds: string[];
}

/** The people to notify: followers of any subject the kind reaches, once each, never the person who caused it. */
export function resolveAudience(kind: NotificationKind, subjects: EventSubjects, follows: FollowRef[], exceptUserId?: string | null): string[] {
  const reaches = new Set(audienceTypes(kind));
  const wanted: Record<FollowTargetType, Set<string>> = {
    championship: new Set([subjects.championshipId]),
    team: new Set(subjects.teamIds),
    player: new Set(subjects.playerIds),
  };
  const users = new Set<string>();
  for (const follow of follows) {
    if (follow.userId === exceptUserId) continue;
    if (reaches.has(follow.targetType) && wanted[follow.targetType].has(follow.targetId)) users.add(follow.userId);
  }
  return [...users];
}

export interface MatchSummary {
  homeName: string;
  awayName: string;
  homeScore?: number | null;
  awayScore?: number | null;
}

const score = (match: MatchSummary) => `${match.homeName} ${match.homeScore ?? 0} - ${match.awayScore ?? 0} ${match.awayName}`;
const versus = (match: MatchSummary) => `${match.homeName} vs ${match.awayName}`;

const when = (date: Date) =>
  date.toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });

export interface Message {
  title: string;
  body: string;
}

export const messages = {
  scheduled(match: MatchSummary, at: Date, rescheduled: boolean): Message {
    return { title: rescheduled ? "Partido reprogramado" : "Partido programado", body: `${versus(match)} · ${when(at)}` };
  },
  started(match: MatchSummary): Message {
    return { title: "¡Comenzó el partido!", body: versus(match) };
  },
  finished(match: MatchSummary): Message {
    return { title: "Final del partido", body: score(match) };
  },
  goal(match: MatchSummary, player: string, minute: number, own: boolean): Message {
    return { title: own ? `Autogol de ${player} (${minute}')` : `¡Gol de ${player}! (${minute}')`, body: score(match) };
  },
  card(match: MatchSummary, player: string, minute: number, red: boolean): Message {
    return { title: `${red ? "Tarjeta roja" : "Tarjeta amarilla"} a ${player} (${minute}')`, body: versus(match) };
  },
  suspension(player: string, matches: number): Message {
    return { title: `${player} fue suspendido`, body: `No jugará ${matches === 1 ? "el próximo partido" : `los próximos ${matches} partidos`}.` };
  },
};

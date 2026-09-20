import type { MatchEventType, MatchPeriod, MatchStatus } from "@/lib/constants";

export interface ScoringEvent {
  type: MatchEventType;
  teamId: string;
  voided: boolean;
}

/** Score derived from the non-voided events; an own goal counts for the opponent. */
export function computeScore(events: readonly ScoringEvent[], homeTeamId: string, awayTeamId: string) {
  let home = 0;
  let away = 0;
  for (const event of events) {
    if (event.voided) continue;
    const scoresForTeam =
      event.type === "goal" || event.type === "penalty_goal"
        ? event.teamId
        : event.type === "own_goal"
          ? event.teamId === homeTeamId ? awayTeamId : homeTeamId
          : null;
    if (scoresForTeam === homeTeamId) home += 1;
    else if (scoresForTeam === awayTeamId) away += 1;
  }
  return { home, away };
}

export type MatchAction = "start" | "halftime" | "resume" | "finish";

interface Phase {
  status: MatchStatus;
  period: MatchPeriod;
}

/** State machine of a live match; returns null when the action is not allowed from the current phase. */
export function applyMatchAction(action: MatchAction, current: Phase): Phase | null {
  const playing = current.status === "live";
  switch (action) {
    case "start":
      return current.status === "scheduled" ? { status: "live", period: "first_half" } : null;
    case "halftime":
      return playing && current.period === "first_half" ? { status: "live", period: "half_time" } : null;
    case "resume":
      return playing && current.period === "half_time" ? { status: "live", period: "second_half" } : null;
    case "finish":
      return playing && current.period !== "not_started" ? { status: "finished", period: "finished" } : null;
  }
}

/** True when the yellow cards counted since the last accumulation ban reach the threshold. */
export const reachesYellowThreshold = (yellowCards: number, threshold: number) => yellowCards >= threshold;

/** Minute to suggest for a new event, from the period clock (first half from 0', second half from 45'). */
export function suggestedMinute(period: MatchPeriod, periodStartedAt: Date | string | undefined, now: Date = new Date()): number {
  if (!periodStartedAt || (period !== "first_half" && period !== "second_half")) return period === "half_time" ? 45 : 0;
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(periodStartedAt).getTime()) / 60000));
  return (period === "second_half" ? 45 : 0) + elapsed;
}

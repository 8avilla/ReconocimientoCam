/** Domain enums shared by models (server) and screens (client). Keep free of server-only imports. */

export const CHAMPIONSHIP_STATUSES = ["draft", "registration_open", "in_progress", "finished"] as const;
export const CHAMPIONSHIP_FORMATS = ["league", "groups", "knockout", "mixed"] as const;
export const POSITIONS = ["Portero", "Defensa", "Volante", "Delantero"] as const;
export const MATCH_STATUSES = ["scheduled", "live", "finished", "postponed", "suspended", "walkover"] as const;
/** The two ways to bucket a match by whether it was already played — used to split "Resultados de
 * partidos" from "Próximos partidos" (a walkover has a result even though it was never actually played out). */
export const PLAYED_MATCH_STATUSES = ["finished", "walkover"] as const;
export const UNPLAYED_MATCH_STATUSES = ["scheduled", "live", "postponed", "suspended"] as const;
export const MATCH_PERIODS = ["not_started", "first_half", "half_time", "second_half", "finished"] as const;
export const MATCH_EVENT_TYPES = [
  "goal", "own_goal", "penalty_goal", "penalty_missed", "yellow_card", "red_card", "substitution", "incident",
] as const;
export const SUSPENSION_REASONS = ["red_card", "yellow_accumulation", "manual"] as const;
export const SUSPENSION_STATUSES = ["active", "served", "lifted"] as const;
export const PHASE_TYPES = ["league", "groups", "knockout"] as const;
/** Applied in this order after points, whichever order the organizer picks; whatever is left unresolved
 * falls back to team name. See `computeStandings` for how each one is compared. */
export const TIEBREAK_CRITERIA = ["head_to_head", "goal_difference", "goals_for", "fewest_goals_against", "most_wins"] as const;
export const REGISTRATION_STATUSES = ["pending", "active", "suspended", "inactive"] as const;
/** Sport-agnostic on purpose: no goalkeeper/pitcher/setter-specific roles, so this fits any team sport. */
export const TEAM_STAFF_ROLES = [
  "head_coach", "assistant_coach", "physical_trainer", "specialist_coach", "medical_staff", "equipment_manager", "other",
] as const;

export type ChampionshipStatus = (typeof CHAMPIONSHIP_STATUSES)[number];
export type ChampionshipFormat = (typeof CHAMPIONSHIP_FORMATS)[number];
export type Position = (typeof POSITIONS)[number];
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type MatchPeriod = (typeof MATCH_PERIODS)[number];
export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];
export type SuspensionStatus = (typeof SUSPENSION_STATUSES)[number];
export type PhaseType = (typeof PHASE_TYPES)[number];
export type TiebreakCriterion = (typeof TIEBREAK_CRITERIA)[number];
export type TeamStaffRole = (typeof TEAM_STAFF_ROLES)[number];

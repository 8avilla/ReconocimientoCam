/** Domain enums shared by models (server) and screens (client). Keep free of server-only imports. */

export const CHAMPIONSHIP_STATUSES = ["draft", "registration_open", "in_progress", "finished"] as const;
export const CHAMPIONSHIP_FORMATS = ["league", "groups", "knockout", "mixed"] as const;
export const POSITIONS = ["Portero", "Defensa", "Volante", "Delantero"] as const;
export const MATCH_STATUSES = ["scheduled", "live", "finished", "postponed", "suspended", "walkover"] as const;
export const MATCH_PERIODS = ["not_started", "first_half", "half_time", "second_half", "finished"] as const;
export const MATCH_EVENT_TYPES = [
  "goal", "own_goal", "penalty_goal", "penalty_missed", "yellow_card", "red_card", "substitution", "incident",
] as const;
export const SUSPENSION_REASONS = ["red_card", "yellow_accumulation", "manual"] as const;
export const SUSPENSION_STATUSES = ["active", "served", "lifted"] as const;
export const REGISTRATION_STATUSES = ["pending", "active", "suspended", "inactive"] as const;

export type ChampionshipStatus = (typeof CHAMPIONSHIP_STATUSES)[number];
export type ChampionshipFormat = (typeof CHAMPIONSHIP_FORMATS)[number];
export type Position = (typeof POSITIONS)[number];
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type MatchPeriod = (typeof MATCH_PERIODS)[number];
export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];
export type SuspensionStatus = (typeof SUSPENSION_STATUSES)[number];

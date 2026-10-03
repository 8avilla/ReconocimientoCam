import { TIEBREAK_CRITERIA, type TiebreakCriterion } from "@/lib/constants";

/** What a phase has always used until its organizer picks otherwise: goal difference, then goals for. */
export const DEFAULT_TIEBREAKERS: readonly TiebreakCriterion[] = ["goal_difference", "goals_for"];

interface PhaseTiebreakers {
  tiebreakers?: readonly TiebreakCriterion[];
  /** True once the organizer saved the list, even an empty one ("no tiebreaker, only points"). */
  tiebreakersCustom?: boolean;
}

/**
 * The criteria in force for a phase, in order. The system offers all of `TIEBREAK_CRITERIA`; the organizer turns each on or
 * off and orders the ones on. A phase never configured uses the default. `tiebreakersCustom` tells "chose none" apart
 * from "never chose": phases saved before the flag existed count as chosen when their list is not empty (an empty list
 * there was only what creation stored, not a decision).
 */
export function resolveTiebreakers(phase: PhaseTiebreakers): TiebreakCriterion[] {
  const custom = phase.tiebreakersCustom ?? Boolean(phase.tiebreakers?.length);
  return custom ? [...(phase.tiebreakers ?? [])] : [...DEFAULT_TIEBREAKERS];
}

/** The criteria not in use, in the order the system lists them. */
export function inactiveTiebreakers(active: readonly TiebreakCriterion[]): TiebreakCriterion[] {
  return TIEBREAK_CRITERIA.filter((criterion) => !active.includes(criterion));
}

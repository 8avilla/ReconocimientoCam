interface PhaseProgress {
  order: number;
  matches: { total: number; finished: number };
}

/**
 * The phase being played: the first one (by order) that has matches still to finish; when every phase with matches
 * is finished, the last of them; before any calendar exists, the first phase.
 */
export function currentPhase<T extends PhaseProgress>(phases: readonly T[]): T | undefined {
  const ordered = [...phases].sort((a, b) => a.order - b.order);
  const withMatches = ordered.filter((phase) => phase.matches.total > 0);
  return withMatches.find((phase) => phase.matches.finished < phase.matches.total) ?? withMatches[withMatches.length - 1] ?? ordered[0];
}

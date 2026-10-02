import { currentPhase } from "@/lib/rules/currentPhase";

/**
 * Several GET requests answered in one round trip (`POST /api/batch`). A screen usually needs 4–8 pieces of data and
 * some of them depend on others (the standings need the current phase, the phases need the championship); asked one
 * by one from a phone each step costs a full network round trip. Here the server runs them side by side, next to the
 * database, and also adds the answers it knows the screen will ask for next.
 *
 * Only the read endpoints listed in `BATCHABLE` can be asked for: each runs through its own handler, so permissions,
 * validation and the shape of the answer are exactly what a direct request would give.
 */
export const MAX_PATHS = 16;
export const MAX_TOTAL = 40;

export interface BatchResult {
  status: number;
  body: unknown;
}

/** The API routes a batch may call, by address pattern. The handler is loaded only when used. */
export const BATCHABLE: { pattern: string; load: () => Promise<{ GET: unknown }> }[] = [
  { pattern: "/matches", load: () => import("@/app/api/matches/route") },
  { pattern: "/matches/:id", load: () => import("@/app/api/matches/[id]/route") },
  { pattern: "/matches/:id/events", load: () => import("@/app/api/matches/[id]/events/route") },
  { pattern: "/matches/:id/attendance", load: () => import("@/app/api/matches/[id]/attendance/route") },
  { pattern: "/suspensions", load: () => import("@/app/api/suspensions/route") },
  { pattern: "/teams", load: () => import("@/app/api/teams/route") },
  { pattern: "/championships/:id", load: () => import("@/app/api/championships/[id]/route") },
  { pattern: "/championships/:id/phases", load: () => import("@/app/api/championships/[id]/phases/route") },
  { pattern: "/championships/:id/stats", load: () => import("@/app/api/championships/[id]/stats/route") },
  { pattern: "/championships/:id/overview", load: () => import("@/app/api/championships/[id]/overview/route") },
  { pattern: "/championships/:id/matchdays", load: () => import("@/app/api/championships/[id]/matchdays/route") },
  { pattern: "/phases/:id/standings", load: () => import("@/app/api/phases/[id]/standings/route") },
];

const compiled = BATCHABLE.map((entry) => ({
  ...entry,
  names: [...entry.pattern.matchAll(/:(\w+)/g)].map((match) => match[1]),
  regex: new RegExp(`^${entry.pattern.replace(/:\w+/g, "([^/?#]+)")}$`),
}));

export interface ParsedPath {
  /** Address without the query string, e.g. `/matches/123/events`. */
  pathname: string;
  /** The whole thing as received (what the screen asks for, and what the answer is filed under). */
  full: string;
}

/** Accepts only plain app-relative addresses: `/matches/…`, no `//host`, no `..`, no fragments. */
export function parseBatchPath(path: string): ParsedPath | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || path.includes("#") || path.length > 600) return null;
  return { pathname: path.split("?")[0], full: path };
}

export function findBatchable(pathname: string) {
  for (const entry of compiled) {
    const match = entry.regex.exec(pathname);
    if (match) return { entry, params: Object.fromEntries(entry.names.map((name, index) => [name, decodeURIComponent(match[index + 1])])) };
  }
  return null;
}

/** `:cid` is the real id of the championship the screen is about, `:route` the id-or-slug as it is in the address bar. */
export function expandTemplates(paths: string[], championship: { id: string; route: string } | null): string[] {
  return paths.map((path) => (championship ? path.replaceAll(":cid", championship.id).replaceAll(":route", championship.route) : path));
}

interface MatchBody {
  championshipId?: string;
  phaseId?: { _id?: string; type?: string };
  homeTeamId?: { _id?: string };
}

/**
 * The answers a screen asks for right after another one (so they are worth sending along): opening a match asks for
 * its championship, the phases, the standings of the match's phase and the home team's results; whatever shows a
 * phase list asks for the standings of the current phase.
 */
export function followUps(pathname: string, body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const match = /^\/matches\/([^/]+)$/.exec(pathname);
  if (match) {
    const { championshipId, phaseId, homeTeamId } = body as MatchBody;
    if (!championshipId) return [];
    return [
      `/championships/${championshipId}`,
      `/championships/${championshipId}/phases`,
      ...(phaseId?._id && phaseId.type !== "knockout" ? [`/phases/${phaseId._id}/standings`] : []),
      ...(homeTeamId?._id ? [`/matches?championshipId=${championshipId}&teamId=${homeTeamId._id}&played=true&order=date&limit=50`] : []),
    ];
  }
  if (/^\/championships\/[^/]+\/phases$/.test(pathname)) {
    const phases = (body as { data?: unknown }).data;
    if (!Array.isArray(phases)) return [];
    const phase = currentPhase(phases as { _id: string; type: string; order: number; matches: { total: number; finished: number } }[]);
    return phase && phase.type !== "knockout" ? [`/phases/${phase._id}/standings`] : [];
  }
  return [];
}

/** Sections inside a championship; each one has its own address so it can be shared (`/c/<id>/partidos`). */
export const SECTIONS = ["partidos", "clasificacion", "equipos", "jugadores", "sanciones", "gestionar"] as const;
export type Section = (typeof SECTIONS)[number];

export function championshipPath(id: string, section?: Section, query = ""): string {
  return `/c/${id}${section ? `/${section}` : ""}${query}`;
}

/** The championship and section a pathname belongs to, when it is under `/c/<id>`. */
export function parseChampionshipPath(pathname: string): { id: string; section: Section | null } | null {
  const match = /^\/c\/([^/]+)(?:\/([^/]+))?/.exec(pathname);
  if (!match) return null;
  const section = SECTIONS.find((item) => item === match[2]) ?? null;
  return { id: match[1], section };
}

/** Old, unscoped list addresses and the section they now live in (they redirect, so old links keep working). */
export const LEGACY_SECTION: Record<string, Section> = {
  "/matches": "partidos",
  "/stats": "clasificacion",
  "/teams": "equipos",
  "/players": "jugadores",
  "/sanctions": "sanciones",
};

/** Detail pages of one entity (a match, a team...): they keep their own address and show the championship's navigation. */
export const isEntityPath = (pathname: string) => ["/matches/", "/teams/", "/players/", "/phases/", "/sanctions/"].some((prefix) => pathname.startsWith(prefix));

/**
 * What each main screen is going to ask for, decided from the address alone, so it can be requested together
 * (`POST /api/batch`) before the screen's code even exists: an inline script in the page's HTML calls this the moment
 * the HTML arrives, while the JavaScript is still downloading (see `EarlyBatchScript`), and the app calls it again when
 * you move between screens.
 *
 * It must stay self-contained (no imports, no outside names): its source text is copied into that inline script. The
 * paths are the very ones the screens build; `e2e/performance.spec.ts` fails if they drift apart (a screen would then
 * ask again for what it already has).
 *
 * `:route` and `:cid` are filled in by the server: the championship as written in the address (an id or a slug) and
 * its real id.
 */
export function screenBatchFor(pathname: string): { paths: string[]; championship?: string } | null {
  const parts = pathname.split("/").filter(Boolean);
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  if (parts[0] === "c" && parts[1]) {
    const route = decode(parts[1]);
    const section = parts[2];
    const common = ["/championships/:route", "/championships/:cid/phases"];
    if (!section) {
      return {
        championship: route,
        paths: [
          ...common,
          "/matches?championshipId=:cid&status=live&order=date&limit=10",
          "/matches?championshipId=:cid&status=scheduled&upcoming=true&order=date&limit=4",
          "/matches?championshipId=:cid&played=true&order=date_desc&limit=4",
          "/championships/:cid/stats",
        ],
      };
    }
    if (section === "partidos") return { championship: route, paths: [...common, "/teams?championshipId=:cid&limit=100", "/championships/:cid/matchdays"] };
    if (section === "clasificacion") return { championship: route, paths: [...common, "/championships/:cid/stats"] };
    if (section === "equipos") return { championship: route, paths: ["/championships/:route", "/teams?championshipId=:cid&limit=100"] };
    return null;
  }
  if (parts[0] === "matches" && parts[1] && !parts[2] && /^[0-9a-f]{24}$/i.test(parts[1])) {
    const id = parts[1];
    return { paths: [`/matches/${id}`, `/matches/${id}/events`, `/matches/${id}/attendance`, `/suspensions?matchId=${id}&limit=50`] };
  }
  return null;
}

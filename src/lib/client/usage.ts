/** `/c/6650…/partidos` -> `/c/:id/partidos`; detail pages (`/matches/<id>`) and any id-looking segment become `:id`. */
export function routePattern(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean).map((part, index, all) => {
    const afterScope = all[0] === "c" && index === 1;
    const afterDetail = index === 1 && ["matches", "teams", "players", "phases", "attendance", "sanctions"].includes(all[0]) && part !== "new";
    return afterScope || afterDetail || /^[0-9a-f]{24}$/i.test(part) ? ":id" : part;
  });
  return `/${parts.join("/")}`.slice(0, 100);
}

let lastSent = "";

/** Tells the server which screen was opened (fire and forget: a failure never reaches the user). */
export function trackView(pathname: string): void {
  const screen = routePattern(pathname);
  if (screen === lastSent) return;
  lastSent = screen;
  try {
    void fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ route: screen }), keepalive: true }).catch(() => undefined);
  } catch {
    // Not tracked when the browser can't send it.
  }
}

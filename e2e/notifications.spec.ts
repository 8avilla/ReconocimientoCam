import { expect, test, type BrowserContext } from "@playwright/test";
import { apiOf, login } from "./support/auth";
import { attendanceOf, firstScheduledMatch, type DemoMatch } from "./support/data";
import { cleanupQa, qaEmail } from "./support/db";
import { setupOrganizer } from "./support/organizer";

/**
 * Following a championship, a team or a player: who gets which notification when an organizer schedules, starts,
 * scores in and finishes a match. Four people: the organizer and one follower of each kind.
 */
test.describe.configure({ mode: "serial" });

interface Notification {
  kind: string;
  title: string;
  body: string;
  url: string;
}

let organizer: Awaited<ReturnType<typeof setupOrganizer>>;
let match: DemoMatch;
let scorer: { _id: string; fullName: string };
const followers = {} as Record<"team" | "championship" | "player", { cookies: Awaited<ReturnType<BrowserContext["cookies"]>> }>;

test.beforeAll(async ({ browser, baseURL }) => {
  await cleanupQa();
  organizer = await setupOrganizer(browser, baseURL!, "notif-organizer");
  const context = await browser.newContext({ baseURL });
  await context.addCookies(organizer.cookies);
  match = await firstScheduledMatch(context.request, organizer.championshipId);
  const home = (await attendanceOf(context.request, match._id)).checkIns.filter((row) => row.teamId === match.homeTeamId._id && row.registrationStatus === "active");
  scorer = home[0].playerId;
  await context.close();

  for (const kind of ["team", "championship", "player"] as const) {
    const follower = await browser.newContext({ baseURL });
    await login(follower, qaEmail(`follower-${kind}`), `ZZ QA follower ${kind}`);
    followers[kind] = { cookies: await follower.cookies() };
    await follower.close();
  }
});

test.afterAll(async () => {
  await cleanupQa();
});

/** An API client acting as one of the people. */
async function as(who: "organizer" | "team" | "championship" | "player", playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"], baseURL: string) {
  const cookies = who === "organizer" ? organizer.cookies : followers[who].cookies;
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies, origins: [] } });
  return { api: apiOf(request), dispose: () => request.dispose() };
}

const notificationsOf = async (api: ReturnType<typeof apiOf>) => (await api.get<{ data: Notification[]; unread: number }>("/notifications")).body;

test("a visitor without an account cannot read notifications", async ({ request }) => {
  expect((await request.get("/api/notifications")).status()).toBe(401);
  expect((await request.get("/api/follows")).status()).toBe(401);
});

test("following from the screens is saved in the account", async ({ page, context, playwright, baseURL }) => {
  await context.addCookies(followers.team.cookies);
  await page.goto(`/teams/${match.homeTeamId._id}`);
  await page.getByRole("button", { name: "Seguir este equipo" }).click();
  const team = await as("team", playwright, baseURL!);
  await expect.poll(async () => (await team.api.get<{ team: string[] }>("/follows")).body.team).toContain(match.homeTeamId._id);
  await team.dispose();

  const championship = await as("championship", playwright, baseURL!);
  expect((await championship.api.post("/follows", { targetType: "championship", targetId: organizer.championshipId })).status).toBe(201);
  await championship.dispose();
  const player = await as("player", playwright, baseURL!);
  expect((await player.api.post("/follows", { targetType: "player", targetId: scorer._id })).status).toBe(201);
  await player.dispose();
});

test("a device can register for pop-ups and a broken one does not break the flow", async ({ playwright, baseURL }) => {
  const team = await as("team", playwright, baseURL!);
  // A device whose address answers nothing: sending to it fails, and nobody should notice.
  const subscribe = await team.api.post("/push/subscriptions", { endpoint: "https://localhost:9/push-qa", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } });
  expect([201, 503]).toContain(subscribe.status); // 503 when the server has no VAPID keys
  await team.dispose();
});

test("scheduling, starting and scoring reach the right followers", async ({ playwright, baseURL }) => {
  const org = await as("organizer", playwright, baseURL!);
  const when = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  expect((await org.api.patch(`/matches/${match._id}`, { scheduledAt: when })).status).toBe(200);
  expect((await org.api.post(`/matches/${match._id}/transition`, { action: "start", force: true, reason: "prueba e2e" })).status).toBe(200);
  expect((await org.api.post(`/matches/${match._id}/events`, { type: "goal", teamId: match.homeTeamId._id, playerId: scorer._id, minute: 12 })).status).toBe(201);
  await org.dispose();

  const team = await as("team", playwright, baseURL!);
  const championship = await as("championship", playwright, baseURL!);
  const player = await as("player", playwright, baseURL!);
  const titles = async (who: typeof team) => (await notificationsOf(who.api)).data.map((item) => item.title);

  // The team's followers hear everything about the team.
  expect(await titles(team)).toEqual(expect.arrayContaining([expect.stringMatching(/^Partido (programado|reprogramado)$/), "¡Comenzó el partido!", `¡Gol de ${scorer.fullName}! (12')`]));
  // The championship's followers get the calendar and the start, not every goal.
  const forChampionship = await titles(championship);
  expect(forChampionship).toEqual(expect.arrayContaining([expect.stringMatching(/^Partido (programado|reprogramado)$/), "¡Comenzó el partido!"]));
  expect(forChampionship.some((title) => title.startsWith("¡Gol de"))).toBe(false);
  // A player's followers hear about the player, nothing else about the match.
  expect(await titles(player)).toEqual([`¡Gol de ${scorer.fullName}! (12')`]);

  // The notification says who scored and the score, and leads to the match.
  const goal = (await notificationsOf(team.api)).data.find((item) => item.kind === "goal")!;
  expect(goal.body).toContain(`${match.homeTeamId.name} 1 - 0 ${match.awayTeamId.name}`);
  expect(goal.url).toBe(`/matches/${match._id}`);
  await Promise.all([team.dispose(), championship.dispose(), player.dispose()]);
});

test("the bell shows what is new, opens the list and clears the badge", async ({ page, context }) => {
  await context.addCookies(followers.team.cookies);
  await page.goto("/");
  const bell = page.getByRole("button", { name: /^Avisos, \d+ sin leer$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const dialog = page.getByRole("dialog", { name: "Avisos" });
  await expect(dialog.getByText(/¡Gol de/)).toBeVisible();
  await expect(dialog.getByText("¡Comenzó el partido!")).toBeVisible();
  await dialog.getByText(/¡Gol de/).click();
  await expect(page).toHaveURL(new RegExp(`/matches/${match._id}`));
  await expect(page.getByRole("button", { name: "Avisos" })).toBeVisible(); // no unread count any more
});

test("after unfollowing the team, its events stop arriving", async ({ page, context, playwright, baseURL }) => {
  await context.addCookies(followers.team.cookies);
  await page.goto(`/teams/${match.homeTeamId._id}`);
  await page.getByRole("button", { name: "Dejar de seguir este equipo" }).click();
  const team = await as("team", playwright, baseURL!);
  await expect.poll(async () => (await team.api.get<{ team: string[] }>("/follows")).body.team).not.toContain(match.homeTeamId._id);
  const before = (await notificationsOf(team.api)).data.length;

  const org = await as("organizer", playwright, baseURL!);
  expect((await org.api.post(`/matches/${match._id}/events`, { type: "yellow_card", teamId: match.homeTeamId._id, playerId: scorer._id, minute: 40 })).status).toBe(201);
  expect((await org.api.post(`/matches/${match._id}/transition`, { action: "finish" })).status).toBe(200);
  await org.dispose();

  expect((await notificationsOf(team.api)).data.length).toBe(before); // neither the card nor the final
  await team.dispose();

  // The others still hear: the player's follower about the card, the championship's follower about the final.
  const player = await as("player", playwright, baseURL!);
  expect((await notificationsOf(player.api)).data.map((item) => item.title)).toContain(`Tarjeta amarilla a ${scorer.fullName} (40')`);
  await player.dispose();
  const championship = await as("championship", playwright, baseURL!);
  expect((await notificationsOf(championship.api)).data.map((item) => item.title)).toContain("Final del partido");
  await championship.dispose();
});

test("notifications and follows disappear with the account", async ({ page, context, playwright, baseURL }) => {
  await context.addCookies(followers.player.cookies);
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  await page.getByRole("dialog").getByLabel(/escribe eliminar/i).fill("ELIMINAR");
  await page.getByRole("dialog").getByRole("button", { name: /eliminar definitivamente/i }).click();
  await expect(page).toHaveURL(/\/$/);
  const gone = await as("player", playwright, baseURL!);
  expect((await gone.api.get("/notifications")).status).toBe(401);
  await gone.dispose();
});

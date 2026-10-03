import { expect, test } from "@playwright/test";
import { apiOf } from "./support/auth";
import { firstScheduledMatch } from "./support/data";
import { cleanupQa } from "./support/db";
import { setupOrganizer } from "./support/organizer";

/**
 * What the screens show must follow what was just changed: a match played, a score, a status. Reading right after the
 * change (the caches in between must not hold the old numbers).
 */
test.describe.configure({ mode: "serial" });

let organizer: Awaited<ReturnType<typeof setupOrganizer>>;

test.beforeAll(async ({ browser, baseURL }) => {
  await cleanupQa();
  organizer = await setupOrganizer(browser, baseURL!, "freshness");
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(organizer.cookies);
});

test.afterAll(async () => {
  await cleanupQa();
});

interface Row {
  teamId: string;
  played: number;
  goalsFor: number;
  points: number;
}
interface Phase {
  _id: string;
  type: string;
}

test("the standings reflect a match as soon as it is changed, however it is read", async ({ context }) => {
  const api = apiOf(context.request);
  const phases = (await api.get<{ data: Phase[] }>(`/championships/${organizer.championshipId}/phases`)).body.data;
  const phase = phases.find((item) => item.type === "league")!;
  const standings = async () => (await api.get<{ tables: { rows: Row[] }[] }>(`/phases/${phase._id}/standings`)).body.tables[0].rows;
  const viaBatch = async () => {
    const response = await api.post<{ results: Record<string, { body: { tables: { rows: Row[] }[] } }> }>("/batch", { championship: organizer.championshipId, paths: ["/championships/:cid/phases"] });
    return response.body.results[`/phases/${phase._id}/standings`]?.body.tables[0].rows;
  };

  const match = await firstScheduledMatch(context.request, organizer.championshipId);
  const home = match.homeTeamId._id;
  const before = await standings(); // warms every cache on the way
  await viaBatch();
  const playedBefore = before.find((row) => row.teamId === home)!.played;
  const goalsBefore = before.find((row) => row.teamId === home)!.goalsFor;

  const attendance = (await api.get<{ checkIns: { teamId: string; registrationStatus: string; playerId: { _id: string } }[] }>(`/matches/${match._id}/attendance`)).body.checkIns;
  const scorer = attendance.find((row) => row.teamId === home && row.registrationStatus === "active")!.playerId._id;

  expect((await api.post(`/matches/${match._id}/transition`, { action: "start", force: true, reason: "prueba e2e" })).status).toBe(200);
  expect((await api.post(`/matches/${match._id}/events`, { type: "goal", teamId: home, playerId: scorer, minute: 10 })).status).toBe(201);
  expect((await api.post(`/matches/${match._id}/transition`, { action: "finish" })).status).toBe(200);

  // Read at once, straight and through the combined request: both must show the finished match.
  for (const rows of [await standings(), (await viaBatch())!]) {
    const after = rows.find((row) => row.teamId === home)!;
    expect(after.played).toBe(playedBefore + 1);
    expect(after.goalsFor).toBe(goalsBefore + 1);
  }

  // And a correction: changing the score of that finished match is reflected too (here by voiding its goal).
  const events = (await api.get<{ data: { _id: string; type: string; voided: boolean }[] }>(`/matches/${match._id}/events`)).body.data;
  const goal = events.find((event) => event.type === "goal" && !event.voided)!;
  expect((await api.post(`/matches/${match._id}/events/${goal._id}/void`, {})).status).toBe(200);
  expect((await standings()).find((row) => row.teamId === home)!.goalsFor).toBe(goalsBefore);
});

test("the table on screen changes after a result is entered on another screen", async ({ page, context }) => {
  const api = apiOf(context.request);
  const match = (await (async () => {
    const list = (await api.get<{ data: { _id: string; status: string; homeTeamId: { _id: string; name: string } }[] }>(`/matches?championshipId=${organizer.championshipId}&limit=100`)).body.data;
    return list.find((item) => item.status === "scheduled")!;
  })());
  const attendance = (await api.get<{ checkIns: { teamId: string; registrationStatus: string; playerId: { _id: string } }[] }>(`/matches/${match._id}/attendance`)).body.checkIns;
  const scorer = attendance.find((row) => row.teamId === match.homeTeamId._id && row.registrationStatus === "active")!.playerId._id;

  await page.goto(`/c/${organizer.championshipId}/clasificacion`);
  const homeRow = page.getByRole("row", { name: new RegExp(match.homeTeamId.name) }).first();
  await expect(homeRow).toBeVisible();
  const playedBefore = await homeRow.getByRole("cell").nth(2).innerText();

  // The result is entered somewhere else (another screen of this same app, or another device).
  await api.post(`/matches/${match._id}/transition`, { action: "start", force: true, reason: "prueba e2e" });
  await api.post(`/matches/${match._id}/events`, { type: "goal", teamId: match.homeTeamId._id, playerId: scorer, minute: 3 });
  await api.post(`/matches/${match._id}/transition`, { action: "finish" });

  // Coming back to the standings (a new visit of the screen) shows it without reloading the page by hand.
  await page.goto(`/c/${organizer.championshipId}/equipos`);
  await page.getByRole("navigation", { name: "Torneo" }).getByRole("link", { name: "Clasificación" }).click();
  const rowAgain = page.getByRole("row", { name: new RegExp(match.homeTeamId.name) }).first();
  await expect(rowAgain).toBeVisible();
  await expect.poll(async () => rowAgain.getByRole("cell").nth(2).innerText()).not.toBe(playedBefore);
});

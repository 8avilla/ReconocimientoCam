import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiOf } from "./support/auth";
import { cleanupQa } from "./support/db";
import { setupOrganizer } from "./support/organizer";

/** Tiebreak criteria of a phase: the system offers them, the organizer turns each on or off and orders the active ones. */
test.describe.configure({ mode: "serial" });

let organizer: Awaited<ReturnType<typeof setupOrganizer>>;
let phase: { _id: string; name: string };

interface PhaseJson {
  _id: string;
  name: string;
  type: string;
  tiebreakers?: string[];
  tiebreakersCustom?: boolean;
}

test.beforeAll(async ({ browser, baseURL }) => {
  await cleanupQa();
  organizer = await setupOrganizer(browser, baseURL!, "tiebreakers");
  const context = await browser.newContext({ baseURL });
  await context.addCookies(organizer.cookies);
  const phases = await apiOf(context.request).get<{ data: PhaseJson[] }>(`/championships/${organizer.championshipId}/phases`);
  phase = phases.body.data.find((item) => item.type === "league")!;
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(organizer.cookies);
});

test.afterAll(async () => {
  await cleanupQa();
});

const phaseAddress = () => `/c/${organizer.championshipId}/gestionar?s=phases&phase=${phase._id}&tab=tiebreakers`;

test("the screen lists the active criteria in order and the ones left unused", async ({ page, context }) => {
  const api = apiOf(context.request);
  await api.patch(`/phases/${phase._id}`, { tiebreakers: ["goal_difference", "goals_for"] });
  await page.goto(phaseAddress());
  const active = page.getByRole("region", { name: "Criterios activos" });
  await expect(active.getByRole("listitem")).toHaveCount(2);
  await expect(active.getByRole("listitem").first()).toContainText("Diferencia de gol");
  const unused = page.getByRole("region", { name: "Criterios inactivos" });
  await expect(unused.getByRole("listitem")).toHaveCount(4);
  await expect(unused).toContainText("Juego limpio");
  await expect(page.getByRole("region", { name: "Puntos de juego limpio" })).toBeHidden();
});

test("turning on fair play adds it last, shows its points, and saves both", async ({ page, context }) => {
  await page.goto(phaseAddress());
  await page.getByRole("switch", { name: "Usar Juego limpio" }).click();
  const active = page.getByRole("region", { name: "Criterios activos" });
  await expect(active.getByRole("listitem").last()).toContainText("Juego limpio");

  const weights = page.getByRole("region", { name: "Puntos de juego limpio" });
  await expect(weights.getByLabel("Por tarjeta amarilla")).toHaveValue("1"); // the defaults: yellow 1, red 2
  await expect(weights.getByLabel("Por tarjeta roja")).toHaveValue("2");
  await weights.getByLabel("Por tarjeta amarilla").fill("2");
  await weights.getByLabel("Por tarjeta roja").fill("5");
  await page.getByRole("button", { name: "Guardar criterios" }).click();
  await expect(page.getByText("Criterios de clasificación guardados")).toBeVisible();

  const api = apiOf(context.request);
  const saved = (await api.get<{ data: PhaseJson[] }>(`/championships/${organizer.championshipId}/phases`)).body.data.find((item) => item._id === phase._id)!;
  expect(saved.tiebreakers).toEqual(["goal_difference", "goals_for", "fair_play"]);
  const championship = (await api.get<{ rules: { fairPlayYellowPoints: number; fairPlayRedPoints: number } }>(`/championships/${organizer.championshipId}`)).body;
  expect(championship.rules).toMatchObject({ fairPlayYellowPoints: 2, fairPlayRedPoints: 5 });
});

test("the standings carry fair play points once the criterion is on, and not when it is off", async ({ context }) => {
  const api = apiOf(context.request);
  const withIt = await api.get<{ tables: { rows: { fairPlay?: number }[] }[] }>(`/phases/${phase._id}/standings`);
  expect(withIt.body.tables[0].rows.every((row) => typeof row.fairPlay === "number")).toBe(true);

  // The points are what the cards say: yellow and red weighed with the championship's own values (here 2 and 5, set above)
  const rules = (await api.get<{ rules: { fairPlayYellowPoints: number; fairPlayRedPoints: number } }>(`/championships/${organizer.championshipId}`)).body.rules;
  const matches = (await api.get<{ data: { _id: string; status: string }[] }>(`/matches?championshipId=${organizer.championshipId}&limit=100`)).body.data.filter((match) => match.status === "finished");
  const expected = new Map<string, number>();
  for (const match of matches) {
    const events = (await api.get<{ data: { _id: string; teamId: string; type: string; voided: boolean; linkedEventId?: string }[] }>(`/matches/${match._id}/events`)).body.data.filter((event) => !event.voided);
    const absorbed = new Set(events.filter((event) => event.type === "red_card" && event.linkedEventId).map((event) => event.linkedEventId));
    for (const event of events) {
      if (event.type !== "yellow_card" && event.type !== "red_card") continue;
      if (event.type === "yellow_card" && absorbed.has(event._id)) continue;
      expected.set(event.teamId, (expected.get(event.teamId) ?? 0) + (event.type === "yellow_card" ? rules.fairPlayYellowPoints : rules.fairPlayRedPoints));
    }
  }
  const standings = (await api.get<{ tables: { rows: { teamId: string; fairPlay?: number }[] }[] }>(`/phases/${phase._id}/standings`)).body.tables[0].rows;
  expect(expected.size).toBeGreaterThan(0); // the demo has cards, so this compares something
  for (const row of standings) expect(row.fairPlay, `team ${row.teamId}`).toBe(expected.get(row.teamId) ?? 0);

  await api.patch(`/phases/${phase._id}`, { tiebreakers: ["goal_difference", "goals_for"] });
  const without = await api.get<{ tables: { rows: { fairPlay?: number }[] }[] }>(`/phases/${phase._id}/standings`);
  expect(without.body.tables[0].rows.every((row) => row.fairPlay === undefined)).toBe(true);
});

test("the screen has no accessibility violations", async ({ page }) => {
  await page.goto(phaseAddress());
  await page.getByRole("switch", { name: "Usar Juego limpio" }).click(); // also with the points section open
  await expect(page.getByRole("region", { name: "Puntos de juego limpio" })).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map((violation) => `${violation.id}: ${violation.help} → ${violation.nodes[0]?.target.join(" ")}`)).toEqual([]);
});

test("a wrong number of points is refused and nothing is saved", async ({ page, context }) => {
  await page.goto(phaseAddress());
  await page.getByRole("switch", { name: "Usar Juego limpio" }).click();
  await page.getByRole("region", { name: "Puntos de juego limpio" }).getByLabel("Por tarjeta roja").fill("101");
  await page.getByRole("button", { name: "Guardar criterios" }).click();
  await expect(page.getByText("Un número entero de 0 a 100")).toBeVisible();
  const saved = (await apiOf(context.request).get<{ data: PhaseJson[] }>(`/championships/${organizer.championshipId}/phases`)).body.data.find((item) => item._id === phase._id)!;
  expect(saved.tiebreakers).not.toContain("fair_play");
});

test("every criterion can be turned off, and that is remembered as a choice", async ({ page, context }) => {
  await page.goto(phaseAddress());
  const active = page.getByRole("region", { name: "Criterios activos" });
  await expect(active.getByRole("switch").first()).toBeVisible(); // the screen has loaded
  while ((await active.getByRole("switch").count()) > 0) await active.getByRole("switch").first().click();
  await expect(page.getByText(/Ninguno activo/)).toBeVisible();
  await page.getByRole("button", { name: "Guardar criterios" }).click();
  await expect(page.getByText("Criterios de clasificación guardados")).toBeVisible();

  const saved = (await apiOf(context.request).get<{ data: PhaseJson[] }>(`/championships/${organizer.championshipId}/phases`)).body.data.find((item) => item._id === phase._id)!;
  expect(saved.tiebreakers).toEqual([]);
  expect(saved.tiebreakersCustom).toBe(true);

  await page.reload();
  await expect(page.getByText(/Ninguno activo/)).toBeVisible(); // still none after a reload (not back to the default)
});

test("the order can be changed with the arrows and is saved in that order", async ({ page, context }) => {
  const api = apiOf(context.request);
  await api.patch(`/phases/${phase._id}`, { tiebreakers: ["goal_difference", "goals_for", "head_to_head"] });
  await page.goto(phaseAddress());
  await page.getByRole("button", { name: "Subir Enfrentamiento directo" }).click();
  await page.getByRole("button", { name: "Subir Enfrentamiento directo" }).click();
  await page.getByRole("button", { name: "Guardar criterios" }).click();
  await expect(page.getByText("Criterios de clasificación guardados")).toBeVisible();
  const saved = (await api.get<{ data: PhaseJson[] }>(`/championships/${organizer.championshipId}/phases`)).body.data.find((item) => item._id === phase._id)!;
  expect(saved.tiebreakers).toEqual(["head_to_head", "goal_difference", "goals_for"]);
});

test("the server refuses a criterion listed twice or one that does not exist", async ({ context }) => {
  const api = apiOf(context.request);
  expect((await api.patch(`/phases/${phase._id}`, { tiebreakers: ["goals_for", "goals_for"] })).status).toBe(400);
  expect((await api.patch(`/phases/${phase._id}`, { tiebreakers: ["magic"] })).status).toBe(400);
});

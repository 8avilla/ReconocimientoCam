import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { apiOf } from "./support/auth";
import { attendanceOf, firstScheduledMatch, type DemoMatch } from "./support/data";
import { cleanupQa, closeDb } from "./support/db";
import { setupOrganizer } from "./support/organizer";

/** An organizer registering attendance on a private demo championship: screens, reports and the offline mode. */
test.describe.configure({ mode: "serial" });

let setup: Awaited<ReturnType<typeof setupOrganizer>>;
let match: DemoMatch;

test.beforeAll(async ({ browser, baseURL }) => {
  await cleanupQa();
  setup = await setupOrganizer(browser, baseURL!, "organizer");
  const context = await browser.newContext({ baseURL });
  await context.addCookies(setup.cookies);
  match = await firstScheduledMatch(context.request, setup.championshipId);
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(setup.cookies);
});

test.afterAll(async () => {
  await cleanupQa();
  await closeDb();
});

const attendanceUrl = () => `/matches/${match._id}?tab=attendance`;

test("the attendance screen has no accessibility violations", async ({ page }) => {
  await page.goto(attendanceUrl());
  await expect(page.getByRole("button", { name: "Guardar para usar sin conexión" })).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map((violation) => `${violation.id}: ${violation.help} → ${violation.nodes[0]?.target.join(" ")}`)).toEqual([]);
});

test("attendance downloads as a spreadsheet and prints as a match sheet", async ({ page }) => {
  await page.goto(attendanceUrl());
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /descargar la asistencia en excel/i }).click();
  const content = readFileSync((await (await download).path())!, "utf8");
  expect(content).toContain("Equipo;Número;Jugador;Asistencia;Método");
  expect(content.split("\r\n").length).toBeGreaterThan(20); // both squads

  await page.getByRole("link", { name: /planilla de juego/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Planilla de juego" })).toBeVisible();
  await expect(page.getByRole("region", { name: `Plantilla de ${match.homeTeamId.name}` })).toBeVisible();
  await expect(page.getByRole("region", { name: `Plantilla de ${match.awayTeamId.name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: /imprimir o guardar como pdf/i })).toBeVisible();
  // When printing, the app's own bars are hidden and the page goes on white.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: /imprimir o guardar como pdf/i })).toBeHidden();
  await expect(page.locator("header[data-print-hide]")).toBeHidden();
});

const needsServiceWorker = () => test.skip(process.env.E2E_DEV === "1", "needs the service worker (production build)");

test("without a connection attendance is kept on the device and synced afterwards", async ({ page, context }) => {
  needsServiceWorker();
  const home = (await attendanceOf(context.request, match._id)).checkIns.filter((row) => row.teamId === match.homeTeamId._id && row.registrationStatus === "active");
  const player = home[0].playerId;

  await page.goto(attendanceUrl());
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30_000 }).catch(async () => page.reload());
  await page.getByRole("button", { name: "Guardar para usar sin conexión" }).click();
  await expect(page.getByText(/guardado el/i)).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Sin conexión").first()).toBeVisible();
  // The saved copy of the screen opens on its default tab: go to attendance like a person would.
  await page.getByRole("tab", { name: "Asistencia" }).click();
  await expect(page.getByRole("button", { name: "Asistencia por cámara" })).toBeDisabled();

  const markedAt = Date.now();
  await page.getByRole("button", { name: `Marcar presente a ${player.fullName}` }).click();
  await expect(page.getByText("Sin enviar").locator("visible=true").first()).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Sin enviar").locator("visible=true")).toHaveCount(0, { timeout: 60_000 });

  const row = (await attendanceOf(context.request, match._id)).checkIns.find((item) => item.playerId._id === player._id)!;
  expect(row.status).toBe("present");
  // Recorded with the time it happened offline, not the time it was synced.
  expect(new Date(row.checkedInAt!).getTime()).toBeLessThan(Date.now() - 1000);
  expect(new Date(row.checkedInAt!).getTime()).toBeGreaterThanOrEqual(markedAt - 1000);
});

test("an offline change that lost against a newer one is reported, not applied", async ({ page, context, playwright, baseURL }) => {
  needsServiceWorker();
  const rows = (await attendanceOf(context.request, match._id)).checkIns.filter((row) => row.teamId === match.homeTeamId._id && row.registrationStatus === "active" && row.status === "pending");
  const player = rows[0].playerId;

  await page.goto(attendanceUrl());
  await page.getByRole("button", { name: "Guardar para usar sin conexión" }).click();
  await expect(page.getByText(/guardado el/i)).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Asistencia" }).click();
  await page.getByRole("button", { name: `Registro manual de ${player.fullName}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Asistencia").selectOption("present");
  await dialog.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Sin enviar").locator("visible=true").first()).toBeVisible();

  // Meanwhile another device (its own connection, same account) marks the same player absent, later.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const otherDevice = await playwright.request.newContext({ baseURL, storageState: { cookies: setup.cookies, origins: [] } });
  const other = await apiOf(otherDevice).post(`/matches/${match._id}/check-ins`, { playerId: player._id, status: "absent", method: "manual" });
  expect(other.status).toBe(201);
  await otherDevice.dispose();
  await context.setOffline(false);
  await expect(page.getByText(/no se pudo aplicar/i).first()).toBeVisible({ timeout: 60_000 });
  const row = (await attendanceOf(context.request, match._id)).checkIns.find((item) => item.playerId._id === player._id)!;
  expect(row.status).toBe("absent");
});

test("signing out wipes what was kept for offline use", async ({ page }) => {
  needsServiceWorker();
  await page.goto(attendanceUrl());
  await page.getByRole("button", { name: "Guardar para usar sin conexión" }).click();
  await expect(page.getByText(/guardado el/i)).toBeVisible();
  const keptAttendance = (id: string) => page.evaluate(async (matchId) => Boolean(await caches.match(`/api/matches/${matchId}/attendance`)), id);
  expect(await keptAttendance(match._id)).toBe(true);
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Pages visited afterwards (signed out) are kept again, but nothing of the organizer's data is.
  await expect.poll(() => keptAttendance(match._id)).toBe(false);
});

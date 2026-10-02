import { expect, test, type Page } from "@playwright/test";
import { demoTemplate } from "./support/data";

/**
 * Speed guards. The numbers are generous on purpose (they must not flake on a slow machine): what they catch is a
 * screen going back to asking for its data piece by piece, or the combined request no longer being used.
 */
function apiCalls(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/") && url.pathname !== "/api/usage") calls.push(`${request.method()} ${url.pathname}${url.search}`);
  });
  return calls;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

test.describe("first load of a screen", () => {
  test("the championship home asks for its data in one combined request", async ({ page, request }) => {
    const template = await demoTemplate(request);
    const calls = apiCalls(page);
    await page.goto(`/c/${template._id}`);
    await expect(page.getByRole("heading", { name: "Goleadores" })).toBeVisible();
    await settle(page);
    expect(calls.filter((call) => call.startsWith("POST /api/batch"))).toHaveLength(1);
    // Besides the batch only today's matches (they depend on the phone's own day) are asked on their own.
    expect(calls.filter((call) => !call.startsWith("POST /api/batch")), calls.join("\n")).toHaveLength(1);
  });

  for (const [section, heading] of [
    ["clasificacion", "Estadísticas"],
    ["equipos", "Equipos"],
    ["partidos", "Partidos"],
  ] as const) {
    test(`${section} needs no request besides the combined one`, async ({ page, request }) => {
      const template = await demoTemplate(request);
      const calls = apiCalls(page);
      await page.goto(`/c/${template._id}/${section}`);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
      await settle(page);
      const own = calls.filter((call) => !call.startsWith("POST /api/batch"));
      // The matches list depends on the filters in the address, so it goes on its own.
      expect(own.filter((call) => !call.includes("/api/matches?")), calls.join("\n")).toEqual([]);
    });
  }

  test("a match needs only the combined request", async ({ page, request }) => {
    const template = await demoTemplate(request);
    const { data } = await (await request.get(`/api/matches?championshipId=${template._id}&played=true&limit=1`)).json();
    const calls = apiCalls(page);
    await page.goto(`/matches/${data[0]._id}`);
    await expect(page.getByRole("heading", { level: 3 }).or(page.getByText("Finalizado")).first()).toBeVisible();
    await settle(page);
    expect(calls.filter((call) => !call.startsWith("POST /api/batch")), calls.join("\n")).toEqual([]);
  });

  test("the page still fills in when the combined answer arrives before the app has started", async ({ page, request, context }) => {
    // A slow connection makes the app's JavaScript late, so the answer is waiting in memory when it starts.
    const template = await demoTemplate(request);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 80, downloadThroughput: (2 * 1024 * 1024) / 8, uploadThroughput: (1024 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(`/c/${template._id}`);
    await expect(page.getByRole("heading", { name: "Goleadores" })).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText("Tabla de posiciones")).toBeVisible();
  });
});

test.describe("moving around", () => {
  test("another screen of the same championship reuses what is already known", async ({ page, request }) => {
    const template = await demoTemplate(request);
    await page.goto(`/c/${template._id}`);
    await expect(page.getByRole("heading", { name: "Goleadores" })).toBeVisible();
    await settle(page);
    const calls = apiCalls(page);
    await page.getByRole("navigation", { name: "Torneo" }).getByRole("link", { name: "Clasificación" }).click();
    await expect(page.getByRole("heading", { name: "Estadísticas" })).toBeVisible();
    await settle(page);
    // The phases, the scorers and the standings were all part of the home's answer.
    expect(calls.filter((call) => /\/phases|\/stats|\/standings/.test(call)), calls.join("\n")).toEqual([]);
  });

  test("the combined request the page's HTML sent is taken over by the app, not left behind", async ({ page, request }) => {
    const template = await demoTemplate(request);
    await page.goto(`/c/${template._id}/equipos`);
    await expect(page.getByText("Bufalos FC")).toBeVisible();
    const before = await page.evaluate(() => Boolean((window as unknown as { __earlyBatch?: unknown }).__earlyBatch));
    expect(before).toBe(false); // the early request was taken over by the app (and not left hanging)
  });
});

test("the server answers the main reads quickly once warm", async ({ request }) => {
  const template = await demoTemplate(request);
  const body = { championship: template._id, paths: ["/championships/:route", "/championships/:cid/phases", "/teams?championshipId=:cid&limit=100", "/championships/:cid/stats"] };
  await request.post("/api/batch", { data: body }); // warm
  const started = Date.now();
  const response = await request.post("/api/batch", { data: body });
  const elapsed = Date.now() - started;
  const { results } = await response.json();
  expect(Object.values(results as Record<string, { status: number }>).every((result) => result.status === 200)).toBe(true);
  // The standings of the current phase come along without being asked for.
  expect(Object.keys(results).some((path) => /^\/phases\/[0-9a-f]{24}\/standings$/.test(path))).toBe(true);
  expect(elapsed, `batch took ${elapsed} ms`).toBeLessThan(4000);
});

test("the batch refuses anything that is not a listed read", async ({ request }) => {
  const response = await request.post("/api/batch", { data: { paths: ["/users", "/auth/session", "/matches/x/check-ins", "//evil.test/x", "/follows"] } });
  const { results } = await response.json();
  for (const result of Object.values(results as Record<string, { status: number }>)) expect(result.status).toBe(404);
  expect((await request.post("/api/batch", { data: { paths: Array.from({ length: 30 }, (_, i) => `/matches/${i}`) } })).status()).toBe(400);
});

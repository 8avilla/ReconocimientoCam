import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: a real browser against `next dev` on its own port (the one in use for development is left alone).
 * They use the database in `.env.local`, so everything they create is named `zz-qa…` and removed afterwards.
 * Needs the demo template (`npm run demo:template`).
 *
 * By default they run against a production build (what ships: it has the service worker, so the offline tests run).
 * `E2E_DEV=1 npm run test:e2e` uses `next dev` instead: faster to start, but the offline tests are skipped.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables itself.
}

const PORT = Number(process.env.E2E_PORT ?? 3199);

export default defineConfig({
  testDir: "e2e",
  // One worker: the tests share one database and some change what others look at.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    locale: "es-CO",
    trace: "retain-on-failure",
    // Set PLAYWRIGHT_CHROMIUM_PATH to use a browser already on the machine instead of Playwright's own download.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: process.env.E2E_DEV === "1" ? `npx next dev -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    env: { NEXT_DIST_DIR: ".next-e2e", PORT: String(PORT) },
    url: `http://localhost:${PORT}/api/auth/csrf`,
    reuseExistingServer: !process.env.CI,
    timeout: 400_000,
  },
});

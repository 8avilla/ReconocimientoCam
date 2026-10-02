import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiOf, login } from "./support/auth";
import { cleanupQa, qaEmail } from "./support/db";

/** The person's own page: who they are, signing out, and deleting the account for good. */
test.describe.configure({ mode: "serial" });

const email = qaEmail("account");

test.beforeAll(async () => {
  await cleanupQa();
});

test.afterAll(async () => {
  await cleanupQa();
});

test.beforeEach(async ({ context }) => {
  await login(context, email, "ZZ QA Cuenta");
});

test("the profile shows the account and has no accessibility violations", async ({ page }) => {
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map((violation) => `${violation.id}: ${violation.help} → ${violation.nodes[0]?.target.join(" ")}`)).toEqual([]);
});

test("deleting the account needs the typed confirmation", async ({ page }) => {
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: /eliminar definitivamente/i });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/escribe eliminar/i).fill("eliminar"); // lower case is not enough
  await expect(confirm).toBeDisabled();
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
});

test("the server refuses a deletion without the confirmation word", async ({ context }) => {
  const api = apiOf(context.request);
  expect((await api.delete("/users/me", { confirm: "no" })).status).toBe(400);
  expect((await api.get("/users/me")).status).toBe(200);
});

test("deleting the account signs out and the old session stops working", async ({ page, context, playwright, baseURL }) => {
  const staleCookies = await context.cookies();
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  await page.getByRole("dialog").getByLabel(/escribe eliminar/i).fill("ELIMINAR");
  await page.getByRole("dialog").getByRole("button", { name: /eliminar definitivamente/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /iniciar sesión/i }).first()).toBeVisible();

  // Someone who kept the old session cookie gets nothing: the account no longer exists.
  const stale = await playwright.request.newContext({ baseURL, storageState: { cookies: staleCookies, origins: [] } });
  expect((await stale.get("/api/notifications")).status()).toBe(401);
  expect((await stale.get("/api/users/me")).status()).toBe(401);
  await stale.dispose();
});

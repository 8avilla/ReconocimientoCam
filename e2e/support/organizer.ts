import type { Browser } from "@playwright/test";
import { login } from "./auth";
import { createDemo, qaEmail } from "./db";

/** A signed-in organizer who owns a private copy of the demo championship; its session cookies are kept for the tests to reuse. */
export async function setupOrganizer(browser: Browser, baseURL: string, name: string) {
  const email = qaEmail(name);
  const context = await browser.newContext({ baseURL, locale: "es-CO" });
  await login(context, email, `ZZ QA ${name}`);
  const { championshipId } = await createDemo(email);
  const cookies = await context.cookies();
  await context.close();
  return { email, championshipId, cookies };
}

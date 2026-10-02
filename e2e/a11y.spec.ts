import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { demoTemplate } from "./support/data";

/**
 * Automated accessibility checks (axe, WCAG 2.0/2.1 A and AA) on the screens people use most. Automated rules catch
 * roughly a third of the problems; they are the floor, not the whole review (keyboard and screen reader checks stay manual).
 */
async function violations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.length} · ${violation.help} → ${violation.nodes[0]?.target.join(" ")}`);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

test.describe("accessibility (visitor)", () => {
  test("home", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    expect(await violations(page)).toEqual([]);
  });

  for (const path of ["/privacidad", "/terminos", "/soporte", "/eliminar-cuenta", "/acerca", "/esto-no-existe"]) {
    test(`legal page ${path}`, async ({ page }) => {
      await page.goto(path);
      await settle(page);
      expect(await violations(page)).toEqual([]);
    });
  }

  for (const section of ["", "/partidos", "/clasificacion", "/equipos"]) {
    test(`championship ${section || "summary"}`, async ({ page, request }) => {
      const template = await demoTemplate(request);
      await page.goto(`/c/${template._id}${section}`);
      await settle(page);
      expect(await violations(page)).toEqual([]);
    });
  }

  test("match detail", async ({ page, request }) => {
    const template = await demoTemplate(request);
    const { data } = await (await request.get(`/api/matches?championshipId=${template._id}&played=true&limit=1`)).json();
    await page.goto(`/matches/${data[0]._id}`);
    await settle(page);
    expect(await violations(page)).toEqual([]);
  });

  test("account modal and notifications modal", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.getByRole("button", { name: "Avisos" }).click();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("keyboard and screen readers", () => {
  test("the first Tab stop skips the top bar and lands on the content", async ({ page }) => {
    await page.goto("/privacidad");
    await settle(page);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#contenido")).toBeFocused();
  });

  test("a dialog traps focus, closes with Escape and gives focus back", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const bell = page.getByRole("button", { name: "Avisos" });
    await bell.click();
    const dialog = page.getByRole("dialog", { name: "Avisos" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // Tabbing many times never leaves the dialog.
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(bell).toBeFocused();
  });

  test("every button and link has a name a screen reader can say", async ({ page, request }) => {
    const template = await demoTemplate(request);
    for (const path of ["/", `/c/${template._id}`, `/c/${template._id}/equipos`]) {
      await page.goto(path);
      await settle(page);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button, a[href], [role=button]")]
          .filter((element) => element.offsetParent !== null)
          .filter((element) => !(element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.textContent?.trim() || element.querySelector("img[alt]:not([alt=''])")))
          .map((element) => element.outerHTML.slice(0, 100))
      );
      expect(unnamed, path).toEqual([]);
    }
  });

  test("touch targets of the main controls are at least 44 px", async ({ page, request }) => {
    const template = await demoTemplate(request);
    await page.goto(`/c/${template._id}`);
    await settle(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("header button, header a, nav a, nav button")]
        .filter((element) => element.offsetParent !== null)
        .map((element) => ({ html: element.outerHTML.slice(0, 80), box: element.getBoundingClientRect() }))
        .filter(({ box }) => box.width < 44 || box.height < 44)
        .map(({ html, box }) => `${Math.round(box.width)}x${Math.round(box.height)} ${html}`)
    );
    expect(small).toEqual([]);
  });

  test("reduced motion is respected", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await settle(page);
    const duration = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.05);
  });
});

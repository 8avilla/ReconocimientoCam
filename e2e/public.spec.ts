import { expect, test } from "@playwright/test";
import { demoTemplate } from "./support/data";

test.describe("visitor (no account)", () => {
  test("home lists championships and opens one", async ({ page, request }) => {
    const template = await demoTemplate(request);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByText(template.name).first())).toBeVisible();
    await page.getByText(template.name).first().click();
    await expect(page).toHaveURL(/\/c\/[^/]+$/); // by slug or by id
    await expect(page.getByRole("navigation", { name: "Torneo" }).first()).toBeVisible();
  });

  test("standings can be downloaded as a spreadsheet", async ({ page, request }) => {
    const template = await demoTemplate(request);
    await page.goto(`/c/${template._id}/clasificacion`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /descargar la tabla de posiciones en excel/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/posiciones\.csv$/);
    const path = await file.path();
    const content = (await import("node:fs")).readFileSync(path!, "utf8");
    expect(content.charCodeAt(0)).toBe(0xfeff); // BOM so Excel reads accents
    expect(content).toContain("Posición;Equipo;PJ");
  });

  test("the calendar can be downloaded too", async ({ page, request }) => {
    const template = await demoTemplate(request);
    await page.goto(`/c/${template._id}/partidos`);
    await expect(page.getByRole("button", { name: /descargar .* en excel/i })).toBeVisible();
  });

  test("legal and support pages are public and linked from the footer", async ({ page }) => {
    await page.goto("/");
    for (const [link, heading] of [
      ["Privacidad", /política de privacidad/i],
      ["Términos", /términos y condiciones/i],
      ["Soporte", /soporte/i],
      ["Acerca de", /acerca de super torneos/i],
    ] as const) {
      await page.getByRole("navigation", { name: "Información legal" }).getByRole("link", { name: link }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.goto("/");
    }
    await page.goto("/eliminar-cuenta");
    await expect(page.getByRole("heading", { level: 1, name: /eliminar mi cuenta/i })).toBeVisible();
  });

  test("an unknown address shows the not-found page, not a login wall", async ({ page }) => {
    const response = await page.goto("/esto-no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
    await page.getByRole("link", { name: "Ir al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("management screens are closed to visitors", async ({ page, request }) => {
    const template = await demoTemplate(request);
    await page.goto(`/c/${template._id}/gestionar`);
    await expect(page.getByText(/inicia sesión para ver esto/i)).toBeVisible();
  });

  test("the web manifest makes the app installable", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ name: "Super Torneos", display: "standalone", start_url: "/" });
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
    expect((await request.get("/.well-known/assetlinks.json")).ok()).toBe(true);
  });
});

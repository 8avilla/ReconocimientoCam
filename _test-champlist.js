const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: process.env.SESSION_TOKEN,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("CONSOLE ERROR: " + msg.text()); });
  await page.goto("http://localhost:3096/c/6ab2f0f0febc2e3143bf862c/jugadores", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator(".champ-switch, [class*='champSwitch'], button:has-text('Liga Master')").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/claude-1000/-home-ivan-Documentos-Proyectos-ReconocimientoCam/89e1d86d-3d74-403f-bcd2-7dc95c44ed7b/scratchpad/champ-switcher.png" });
  console.log("ERRORS:", JSON.stringify(errors, null, 2));
  await browser.close();
})();

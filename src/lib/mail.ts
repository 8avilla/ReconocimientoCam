/**
 * Sends transactional email via Mailgun's HTTP API (no SDK: a single authenticated POST, so no new
 * dependency). Configured entirely through env vars: MAIL_API_KEY, MAIL_DOMAIN, MAIL_BASE_URL,
 * MAIL_FROM_EMAIL, MAIL_FROM_NAME.
 */
export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.MAIL_API_KEY;
  const domain = process.env.MAIL_DOMAIN;
  const baseUrl = process.env.MAIL_BASE_URL;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME ?? "Super Torneos";
  if (!apiKey || !domain || !baseUrl || !fromEmail) {
    throw new Error("Falta configurar el envío de correo (MAIL_API_KEY/MAIL_DOMAIN/MAIL_BASE_URL/MAIL_FROM_EMAIL)");
  }

  const body = new URLSearchParams({ from: `${fromName} <${fromEmail}>`, to, subject, html });
  const response = await fetch(`${baseUrl}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Mailgun respondió ${response.status}: ${text}`);
  }
}

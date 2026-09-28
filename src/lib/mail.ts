import nodemailer from "nodemailer";

/**
 * Sends transactional email via SMTP using Nodemailer.
 * Configured through env vars: SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM_EMAIL, MAIL_FROM_NAME.
 */
export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const host = process.env.SMTP_HOST || "smtp.mailgun.org";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME ?? "Super Torneos";

  if (!user || !pass || !fromEmail) {
    throw new Error("Falta configurar el envío de correo SMTP (SMTP_USER/SMTP_PASS/MAIL_FROM_EMAIL)");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: 587,
    secure: false, // TLS
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
  });
}

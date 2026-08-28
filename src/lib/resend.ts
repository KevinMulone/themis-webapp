import 'server-only';
import { Resend } from 'resend';

export async function sendLicenseKeyEmail({
  to,
  key,
  planLabel,
}: {
  to: string;
  key: string;
  planLabel: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: 'La tua chiave di attivazione Themis',
    html: `
      <p>Grazie per esserti abbonato al piano <strong>${planLabel}</strong> di Themis.</p>
      <p>Ecco la tua chiave di attivazione:</p>
      <p style="font-family: monospace; font-size: 14px; background:#f4f4f4; padding: 12px; border-radius: 6px; word-break: break-all;">${key}</p>
      <p>Incollala nella pagina di attivazione per iniziare a usare Themis: <a href="${siteUrl}/attiva">${siteUrl}/attiva</a></p>
    `,
  });
}

import 'server-only';
import { Resend } from 'resend';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]!);
}

async function pausa(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function inviaConRitentativi(payload: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('Servizio email non configurato');

  const resend = new Resend(apiKey);
  let ultimoErrore = 'errore sconosciuto';
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    try {
      const { error } = await resend.emails.send({ ...payload, from });
      if (!error) return;
      ultimoErrore = error.message;
      const status = 'statusCode' in error ? Number(error.statusCode) : 0;
      if (status !== 429 && status < 500) break;
    } catch (errore) {
      ultimoErrore = errore instanceof Error ? errore.message : String(errore);
    }
    if (tentativo < 2) await pausa(500 * (2 ** tentativo));
  }
  console.error('Email transazionale non inviata:', ultimoErrore);
  throw new Error('Invio email non riuscito');
}

export async function sendLicenseKeyEmail({
  to,
  key,
  planLabel,
}: {
  to: string;
  key: string;
  planLabel: string;
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const safeKey = escapeHtml(key);
  const safePlan = escapeHtml(planLabel);
  const safeUrl = escapeHtml(`${siteUrl}/attiva`);
  await inviaConRitentativi({
    to,
    subject: 'La tua chiave di attivazione Themis',
    html: `
      <p>Grazie per esserti abbonato al piano <strong>${safePlan}</strong> di Themis.</p>
      <p>Ecco la tua chiave di attivazione:</p>
      <p style="font-family: monospace; font-size: 14px; background:#f4f4f4; padding: 12px; border-radius: 6px; word-break: break-all;">${safeKey}</p>
      <p>Incollala nella pagina di attivazione per iniziare a usare Themis: <a href="${safeUrl}">${safeUrl}</a></p>
    `,
  });
}

export async function sendRefundRequestEmail({
  nomeStudio,
  email,
  plan,
  stripeCustomerId,
}: {
  nomeStudio: string | null;
  email: string;
  plan: string | null;
  stripeCustomerId: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error('ADMIN_EMAIL non configurata');
  const safeNome = escapeHtml(nomeStudio || '(senza nome)');
  const safeEmail = escapeHtml(email);
  const safePlan = escapeHtml(plan || '—');
  const safeCustomer = escapeHtml(stripeCustomerId);
  await inviaConRitentativi({
    to: adminEmail,
    subject: `Richiesta di rimborso — ${nomeStudio || email}`.replace(/[\r\n]/g, ' '),
    html: `
      <p>Lo studio <strong>${safeNome}</strong> (${safeEmail}) ha richiesto il rimborso entro la finestra di 4 giorni dal primo pagamento.</p>
      <p>Piano: ${safePlan}</p>
      <p>Cliente Stripe: ${safeCustomer}</p>
      <p>Vai su Stripe Dashboard per elaborare il rimborso e disdire l'abbonamento.</p>
    `,
  });
}

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateLicenseKey } from '@/lib/licenseKeyServer';
import { isPlanKey } from '@/lib/stripe/plans';

export const runtime = 'nodejs';

/**
 * Genera una chiave di licenza dal pannello amministratore.
 *
 * Fa esattamente ciò che faceva keygen.py sul computer di Kevin — stessa
 * chiave privata Ed25519, stesso formato del payload, stessa registrazione
 * in issued_licenses — ma da qui, senza dover aprire il terminale.
 *
 * La scadenza è scritta come "DAYS:N", cioè N giorni dalla PRIMA
 * attivazione e non dalla generazione: una chiave consegnata oggi e usata
 * fra due settimane vale comunque N giorni pieni.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { giorni, plan } = await request.json();
  const n = Number(giorni);
  if (!Number.isInteger(n) || n < 1 || n > 3650) {
    return NextResponse.json({ error: 'Durata non valida' }, { status: 400 });
  }
  if (typeof plan !== 'string' || !isPlanKey(plan)) {
    return NextResponse.json({ error: 'Piano non valido' }, { status: 400 });
  }

  const licenseId = randomUUID().replace(/-/g, '').slice(0, 12);
  const expiresAt = `DAYS:${n}`;

  let key: string;
  try {
    key = generateLicenseKey(licenseId, expiresAt, plan);
  } catch {
    // Il caso tipico: LICENSE_ED25519_PRIVATE_KEY_PEM assente o incollata
    // male fra le variabili d'ambiente.
    return NextResponse.json({
      error: 'Chiave di firma non disponibile: controlla LICENSE_ED25519_PRIVATE_KEY_PEM.',
    }, { status: 500 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('issued_licenses').insert({
    license_id: licenseId, plan, expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, key, license_id: licenseId, giorni: n, plan });
}

import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { GOOGLE_KEY_SCOPE_PREFIX, scambiaCodice, emailAccount } from '@/lib/google/calendar';

function vaiA(pagina: string) {
  return NextResponse.redirect(new URL(`/impostazioni?google=${pagina}`, process.env.NEXT_PUBLIC_SITE_URL));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const errore = searchParams.get('error');
  if (errore) return vaiA('annullato');
  if (!code) return vaiA('errore');

  const contesto = await contestoStudio();
  if (!contesto || contesto.ruolo !== 'titolare') return vaiA('errore');

  try {
    const token = await scambiaCodice(code);
    if (!token.refresh_token) {
      // Succede se l'account aveva già autorizzato Themis in passato e
      // Google non ripropone un refresh_token: da qui si ridà seguito
      // solo scollegando e ricollegando da capo (prompt=consent nella
      // route connetti dovrebbe evitarlo, ma un margine va previsto).
      return vaiA('senza_refresh_token');
    }
    const email = await emailAccount(token.access_token);

    const admin = createAdminClient();
    const refreshCifrato = encryptBuffer(
      Buffer.from(token.refresh_token, 'utf-8'),
      GOOGLE_KEY_SCOPE_PREFIX + contesto.studioId,
    ).toString('base64');

    await admin.from('google_calendar_credenziali').upsert(
      { studio_id: contesto.studioId, refresh_token_cifrato: refreshCifrato, updated_at: new Date().toISOString() },
      { onConflict: 'studio_id' },
    );
    await admin.from('google_calendar_account').upsert(
      { studio_id: contesto.studioId, google_email: email, attivo: true, updated_at: new Date().toISOString() },
      { onConflict: 'studio_id' },
    );

    return vaiA('connesso');
  } catch {
    return vaiA('errore');
  }
}

import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { GOOGLE_KEY_SCOPE_PREFIX, revocaToken } from '@/lib/google/calendar';

export async function POST() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può scollegare Google Calendar' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from('google_calendar_credenziali')
    .select('refresh_token_cifrato')
    .eq('studio_id', contesto.studioId)
    .maybeSingle();

  if (cred) {
    const refreshToken = decryptBuffer(
      Buffer.from(cred.refresh_token_cifrato, 'base64'),
      GOOGLE_KEY_SCOPE_PREFIX + contesto.studioId,
    ).toString('utf-8');
    await revocaToken(refreshToken);
  }

  await admin.from('google_calendar_credenziali').delete().eq('studio_id', contesto.studioId);
  await admin.from('google_calendar_account').delete().eq('studio_id', contesto.studioId);

  return NextResponse.json({ ok: true });
}

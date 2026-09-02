import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';
import { disconnettiWorker } from '@/lib/whatsapp/worker';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può scollegare WhatsApp' }, { status: 403 });
  }

  try {
    await disconnettiWorker(contesto.studioId);
  } catch {
    // Anche se il worker non risponde, si azzera comunque lo stato locale:
    // l'avvocato ha chiesto di scollegare, e non deve restare "connesso"
    // in interfaccia solo perché il servizio esterno era irraggiungibile.
  }

  const admin = createAdminClient();
  await admin.from('whatsapp_account').delete().eq('studio_id', contesto.studioId);

  return NextResponse.json({ ok: true });
}

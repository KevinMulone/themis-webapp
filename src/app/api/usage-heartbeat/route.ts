import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';

// Chiamata ogni 60 secondi da UsageTracker mentre la scheda è visibile:
// ogni chiamata vale sempre 60 secondi, non ci fidiamo di un valore
// "tempo trascorso" mandato dal client (potrebbe essere sbagliato dopo che
// il computer si è sospeso). Non è un dato di fatturazione, solo una stima
// per l'amministratore: un margine di imprecisione è accettabile.
const SECONDI_PER_HEARTBEAT = 60;

export async function POST() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { studioId } = contesto;

  const admin = createAdminClient();
  const { data: studio } = await admin
    .from('studios')
    .select('tempo_utilizzo_secondi')
    .eq('id', studioId)
    .single();

  const attuale = studio?.tempo_utilizzo_secondi ?? 0;
  await admin
    .from('studios')
    .update({ tempo_utilizzo_secondi: attuale + SECONDI_PER_HEARTBEAT })
    .eq('id', studioId);

  return NextResponse.json({ ok: true });
}

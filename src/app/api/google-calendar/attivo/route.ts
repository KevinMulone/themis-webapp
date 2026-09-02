import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';

/** Accende o spegne la sincronizzazione, senza scollegare l'account: si
 * riattiva senza dover rifare il consenso da capo. */
export async function PATCH(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può gestire Google Calendar' }, { status: 403 });
  }
  const { attivo } = (await request.json()) as { attivo: boolean };

  const admin = createAdminClient();
  const { error } = await admin
    .from('google_calendar_account')
    .update({ attivo, updated_at: new Date().toISOString() })
    .eq('studio_id', contesto.studioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

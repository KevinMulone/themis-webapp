import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';

/**
 * Crea o rigenera il link privato al calendario dello studio.
 *
 * Rigenerare non è un'operazione innocua e l'interfaccia lo dice: il
 * vecchio indirizzo smette di funzionare all'istante, e chi lo aveva
 * iscritto in Google Calendar smetterà di vedere gli aggiornamenti finché
 * non gli si dà quello nuovo. È il comportamento voluto — è l'unico modo
 * di revocare un link finito dove non doveva.
 */
export async function POST() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può gestire il link del calendario' }, { status: 403 });
  }

  const token = randomBytes(32).toString('hex');
  const admin = createAdminClient();
  const { error } = await admin
    .from('studio_settings')
    .upsert({ studio_id: contesto.studioId, calendario_ics_token: token }, { onConflict: 'studio_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, token });
}

/** Spegne la pubblicazione: da qui in poi l'indirizzo non risponde più. */
export async function DELETE() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può gestire il link del calendario' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('studio_settings')
    .update({ calendario_ics_token: null })
    .eq('studio_id', contesto.studioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountGoogleAttivo } from '@/lib/google/accesso';
import { elencaEventiGoogle } from '@/lib/google/calendar';

/**
 * Porta dentro Themis ciò che c'era già nel Google Calendar dello
 * studio, in un intervallo di date scelto da chi importa. Ogni evento
 * arriva come tipo "altro" — Google non sa distinguere un'udienza da un
 * appuntamento, quella distinzione va fatta a mano dopo, se serve.
 *
 * Chi ha già un google_event_id salvato non viene reimportato: sono gli
 * impegni che Themis stesso ha creato e già riflesso su Google, tornare
 * indietro li duplicherebbe.
 */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può importare da Google Calendar' }, { status: 403 });
  }

  const { da, a } = (await request.json()) as { da: string; a: string };
  if (!da || !a) return NextResponse.json({ error: 'Intervallo di date mancante' }, { status: 400 });

  const account = await accountGoogleAttivo(contesto.studioId);
  if (!account) return NextResponse.json({ error: 'Google Calendar non è collegato o è disattivato' }, { status: 400 });

  const admin = createAdminClient();

  let eventiGoogle;
  try {
    eventiGoogle = await elencaEventiGoogle(account.accessToken, account.calendarId, da, a);
  } catch {
    return NextResponse.json({ error: 'Lettura da Google Calendar non riuscita' }, { status: 502 });
  }

  const { data: giaPresenti } = await admin
    .from('eventi')
    .select('google_event_id')
    .eq('studio_id', contesto.studioId)
    .not('google_event_id', 'is', null);
  const idGiaPresenti = new Set((giaPresenti || []).map((r) => r.google_event_id));

  const daInserire = eventiGoogle
    .filter((ev) => !idGiaPresenti.has(ev.id))
    .map((ev) => ({
      studio_id: contesto.studioId,
      titolo: ev.titolo,
      tipo: 'altro',
      data: ev.data,
      ora_inizio: ev.ora_inizio,
      ora_fine: ev.ora_fine,
      all_day: ev.all_day,
      note: ev.note,
      google_event_id: ev.id,
    }));

  if (daInserire.length > 0) {
    const { error } = await admin.from('eventi').insert(daInserire);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, importati: daInserire.length, totaliSuGoogle: eventiGoogle.length });
}

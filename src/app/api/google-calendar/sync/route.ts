import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountGoogleAttivo } from '@/lib/google/accesso';
import { creaEventoGoogle, eliminaEventoGoogle } from '@/lib/google/calendar';

/**
 * Il riflesso di un impegno su Google, in una direzione sola. Se lo
 * studio non ha Google Calendar attivo, risponde comunque ok — non è un
 * errore, è semplicemente niente da fare. Un fallimento qui non deve mai
 * bloccare il salvataggio in Themis: l'impegno è già nel calendario vero,
 * la copia su Google è un di più.
 */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { eventoId, azione, googleEventId } = (await request.json()) as {
    eventoId?: string; azione: 'crea' | 'elimina'; googleEventId?: string | null;
  };

  const account = await accountGoogleAttivo(contesto.studioId).catch(() => null);
  if (!account) return NextResponse.json({ ok: true, saltato: true });

  const admin = createAdminClient();

  try {
    if (azione === 'crea') {
      if (!eventoId) return NextResponse.json({ error: 'eventoId mancante' }, { status: 400 });
      const { data: evento } = await admin
        .from('eventi')
        .select('titolo, tipo, data, ora_inizio, ora_fine, all_day, luogo, note, studio_id')
        .eq('id', eventoId).single();
      if (!evento || evento.studio_id !== contesto.studioId) {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      const idGoogle = await creaEventoGoogle(account.accessToken, account.calendarId, evento);
      await admin.from('eventi').update({ google_event_id: idGoogle }).eq('id', eventoId);
      return NextResponse.json({ ok: true, googleEventId: idGoogle });
    }

    if (azione === 'elimina') {
      if (!googleEventId) return NextResponse.json({ ok: true }); // niente da cancellare su Google
      await eliminaEventoGoogle(account.accessToken, account.calendarId, googleEventId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Azione non riconosciuta' }, { status: 400 });
  } catch (e) {
    // Non falso allarme al cliente: l'impegno in Themis c'è comunque.
    // Si registra solo lato server, per ora nel log — non c'è ancora un
    // posto in interfaccia dove mostrare "sincronizzazione non riuscita".
    console.error('Sincronizzazione Google Calendar non riuscita', e);
    return NextResponse.json({ ok: false, error: 'Sincronizzazione con Google non riuscita' }, { status: 502 });
  }
}

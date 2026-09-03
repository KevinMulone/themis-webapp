import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Qui arriva, dal worker, l'avanzamento di un messaggio che Themis ha
 * mandato: 1 spunta (inviato) -> 2 grigie (consegnato) -> 2 blu (letto).
 * Route a parte rispetto a /webhook: sono due notizie di natura diversa
 * (un messaggio nuovo, contro un aggiornamento su uno già salvato), e
 * tenerle separate evita di dover distinguere i due casi dentro un'unica
 * route con forme diverse di corpo della richiesta.
 *
 * I valori di `status` sono quelli di Baileys (WAMessageStatus):
 * 0 errore, 1 in attesa, 2 mandato al server, 3 consegnato, 4 letto,
 * 5 ascoltato (per gli audio — si conta come letto).
 */
export async function POST(request: Request) {
  const segreto = process.env.WHATSAPP_WORKER_SECRET;
  if (!segreto || request.headers.get('authorization') !== `Bearer ${segreto}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  const { studioId, waMessageId, status } = corpo ?? {};
  if (typeof studioId !== 'string' || typeof waMessageId !== 'string' || typeof status !== 'number') {
    return NextResponse.json({ error: 'Richiesta malformata' }, { status: 400 });
  }

  const statoInvio = status >= 4 ? 'letto' : status === 3 ? 'consegnato' : status === 2 ? 'inviato' : null;
  if (!statoInvio) return NextResponse.json({ ok: true, ignorato: true });

  const admin = createAdminClient();
  // L'ordine non deve tornare indietro: un "letto" arrivato prima del
  // "consegnato" (capita, gli eventi non sono sempre in sequenza) non
  // deve essere sovrascritto dal "consegnato" arrivato dopo in ritardo.
  const ORDINE: Record<string, number> = { inviato: 1, consegnato: 2, letto: 3 };
  const { data: riga } = await admin
    .from('whatsapp_messaggi').select('stato_invio')
    .eq('studio_id', studioId).eq('wa_message_id', waMessageId).eq('direzione', 'out').maybeSingle();
  if (!riga) return NextResponse.json({ ok: true, ignorato: true });
  if (riga.stato_invio && ORDINE[riga.stato_invio] >= ORDINE[statoInvio]) {
    return NextResponse.json({ ok: true, ignorato: true });
  }

  await admin.from('whatsapp_messaggi')
    .update({ stato_invio: statoInvio })
    .eq('studio_id', studioId).eq('wa_message_id', waMessageId);

  return NextResponse.json({ ok: true });
}

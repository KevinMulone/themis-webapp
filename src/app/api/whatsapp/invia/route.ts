import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { inviaWorker } from '@/lib/whatsapp/worker';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Invia la risposta che il difensore ha scritto (o riscritto) a partire
 * dalla bozza. Non è un atto giuridico come una PEC: aperto a chiunque
 * lavori nello studio, non solo al titolare — la garanzia non sta in chi
 * preme il tasto, ma nel fatto che il testo passa sempre da qui, mai
 * inviato da solo da Themis.
 */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { messaggioId, testo } = await request.json();
  if (typeof messaggioId !== 'string' || typeof testo !== 'string' || !testo.trim()) {
    return NextResponse.json({ error: 'Manca il messaggio a cui rispondere, o il testo è vuoto' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: originale } = await admin
    .from('whatsapp_messaggi')
    .select('id, jid_mittente, matter_id, cliente_id')
    .eq('id', messaggioId).eq('studio_id', contesto.studioId).maybeSingle();
  if (!originale) return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });

  let waMessageId: string;
  try {
    // L'indirizzo va passato per intero, dominio compreso: WhatsApp usa
    // sia "@s.whatsapp.net" (numero di telefono) sia "@lid" (il suo
    // identificativo privato più recente), e togliere il dominio per poi
    // riattaccarne uno fisso avrebbe mandato il messaggio a un indirizzo
    // che non esiste.
    waMessageId = await inviaWorker(contesto.studioId, originale.jid_mittente, testo.trim());
  } catch (errore) {
    return NextResponse.json(
      { error: errore instanceof Error ? errore.message : 'Invio non riuscito' },
      { status: 502 },
    );
  }

  // Si registra anche il messaggio in uscita: senza, la conversazione
  // mostrata in Themis avrebbe solo metà dei turni. L'id è quello VERO
  // assegnato da WhatsApp (se il worker l'ha restituito): serve a
  // riconoscere gli aggiornamenti di stato (consegnato, letto) che
  // arrivano più avanti riferiti a questo stesso messaggio.
  await admin.from('whatsapp_messaggi').insert({
    studio_id: contesto.studioId,
    wa_message_id: waMessageId || `out-${randomUUID()}`,
    jid_mittente: originale.jid_mittente,
    matter_id: originale.matter_id,
    cliente_id: originale.cliente_id,
    stato_match: originale.cliente_id ? 'abbinato' : 'non_riconosciuto',
    testo_cifrato: encryptBuffer(Buffer.from(testo.trim(), 'utf-8'), contesto.studioId).toString('base64'),
    direzione: 'out',
    stato_invio: 'inviato',
    analizzato: true,
  });

  return NextResponse.json({ ok: true });
}

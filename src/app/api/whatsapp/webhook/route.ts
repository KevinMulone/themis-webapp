import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { normalizzaNumero, numeroDaJid, numeriEquivalenti } from '@/lib/whatsapp/numero';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Qui arrivano i messaggi dal servizio WhatsApp esterno (`whatsapp-worker/`),
 * mai dal browser. L'unica credenziale è il segreto condiviso — lo stesso
 * schema già in uso per il cron delle PEC (`CRON_SECRET`), applicato in
 * direzione opposta: lì Vercel chiama sé stesso, qui è un servizio esterno
 * a chiamare Vercel.
 */
export async function POST(request: Request) {
  const segreto = process.env.WHATSAPP_WORKER_SECRET;
  if (!segreto || request.headers.get('authorization') !== `Bearer ${segreto}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  const { studioId, from, text, waMessageId } = corpo ?? {};
  if (typeof studioId !== 'string' || typeof from !== 'string'
    || typeof text !== 'string' || typeof waMessageId !== 'string') {
    return NextResponse.json({ error: 'Messaggio malformato' }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ ok: true, ignorato: true });

  const admin = createAdminClient();
  const numero = numeroDaJid(from);

  // Si cerca il cliente per numero fra quelli dello studio: clients.telefono
  // è un campo libero scritto a mano, quindi il confronto passa da
  // numeriEquivalenti (ultime 9 cifre), non da un'uguaglianza esatta.
  const { data: clienti } = await admin
    .from('clients').select('id, telefono').eq('studio_id', studioId).not('telefono', 'is', null);
  const trovato = (clienti ?? []).find((c) => c.telefono && numeriEquivalenti(c.telefono, numero));

  // Se il cliente è riconosciuto e ha UNA sola pratica non archiviata, il
  // messaggio si aggancia subito anche a quella: indovinare fra due
  // sarebbe sbagliare tanto quanto non collegare nulla.
  let matterId: string | null = null;
  if (trovato) {
    const { data: pratiche } = await admin
      .from('matters').select('id').eq('client_id', trovato.id).neq('stato', 'archiviata').limit(2);
    if (pratiche && pratiche.length === 1) matterId = pratiche[0].id;
  }

  const { error } = await admin.from('whatsapp_messaggi').insert({
    studio_id: studioId,
    wa_message_id: waMessageId,
    jid_mittente: from,
    numero_normalizzato: normalizzaNumero(numero),
    cliente_id: trovato?.id ?? null,
    matter_id: matterId,
    stato_match: trovato ? 'abbinato' : 'non_riconosciuto',
    testo_cifrato: encryptBuffer(Buffer.from(text, 'utf-8'), studioId).toString('base64'),
    direzione: 'in',
  });

  // Un conflitto sul vincolo (studio_id, wa_message_id) significa che il
  // worker ha riconsegnato lo stesso messaggio (capita dopo un riavvio):
  // non è un errore, è esattamente il caso per cui esiste quel vincolo.
  if (error && error.code !== '23505') {
    console.error('Messaggio WhatsApp non salvato:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

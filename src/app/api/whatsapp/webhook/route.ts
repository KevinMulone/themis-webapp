import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { normalizzaNumero, numeroDaJid } from '@/lib/whatsapp/numero';
import { trovaClienteEPratica } from '@/lib/whatsapp/abbinamento';

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
  const { studioId, from, text, waMessageId, pushName, timestampMs } = corpo ?? {};
  // "direzione" arriva solo dall'importazione della cronologia (la
  // ricezione dal vivo è sempre e solo 'in': i messaggi mandati da qui si
  // registrano già da soli in /api/whatsapp/invia).
  const direzione = corpo?.direzione === 'out' ? 'out' : 'in';
  if (typeof studioId !== 'string' || typeof from !== 'string'
    || typeof text !== 'string' || typeof waMessageId !== 'string') {
    return NextResponse.json({ error: 'Messaggio malformato' }, { status: 400 });
  }
  if (!text.trim()) return NextResponse.json({ ok: true, ignorato: true });

  const admin = createAdminClient();
  const numero = numeroDaJid(from);
  const { clienteId, matterId } = await trovaClienteEPratica(admin, studioId, numero);

  const cifrato = encryptBuffer(Buffer.from(text, 'utf-8'), studioId).toString('base64');
  const ricevutoIl = typeof timestampMs === 'number' && timestampMs > 0
    ? new Date(timestampMs).toISOString() : undefined;

  const { error } = await admin.from('whatsapp_messaggi').insert({
    studio_id: studioId,
    wa_message_id: waMessageId,
    jid_mittente: from,
    numero_normalizzato: normalizzaNumero(numero),
    cliente_id: clienteId,
    matter_id: matterId,
    stato_match: clienteId ? 'abbinato' : 'non_riconosciuto',
    testo_cifrato: cifrato,
    nome_whatsapp: typeof pushName === 'string' && pushName.trim() ? pushName.trim().slice(0, 200) : null,
    direzione,
    // Per la cronologia importata, la data vera del messaggio — non il
    // momento in cui è stata importata, altrimenti anni di conversazione
    // comparirebbero tutti "adesso" e fuori ordine.
    ...(ricevutoIl ? { ricevuto_il: ricevutoIl } : {}),
    ...(direzione === 'out' ? { stato_invio: 'inviato' } : {}),
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

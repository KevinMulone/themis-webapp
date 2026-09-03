import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { normalizzaNumero, numeroDaJid } from '@/lib/whatsapp/numero';
import { trovaClienteEPratica } from '@/lib/whatsapp/abbinamento';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Un file più grande di questo viene rifiutato: sotto al limite di 4,5 MB
// che Vercel impone comunque su ogni richiesta (non alzabile da codice),
// con un margine per la codifica base64 che gonfia le dimensioni di circa
// un terzo e per il resto del corpo della richiesta.
const MASSIMO_BYTE = 3 * 1024 * 1024;

/**
 * Un documento (o un'immagine) ricevuto su WhatsApp, dal worker esterno.
 * Stessa autenticazione di /webhook, route a sé perché il corpo della
 * richiesta è di natura diversa (un file, non del testo).
 *
 * Si salva SEMPRE, cifrato come ogni altro documento del fascicolo — mai
 * scartato in silenzio, anche se il numero non è ancora collegato a
 * nessun cliente. Solo quando il numero risulta abbinato a UNA sola
 * pratica non archiviata, il documento si aggancia da solo anche lì
 * (compare direttamente fra i documenti di quella pratica); altrimenti
 * resta recuperabile dal messaggio stesso, in attesa che l'avvocato lo
 * colleghi a mano — esattamente come già succede per i messaggi di testo.
 */
export async function POST(request: Request) {
  const segreto = process.env.WHATSAPP_WORKER_SECRET;
  if (!segreto || request.headers.get('authorization') !== `Bearer ${segreto}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  const { studioId, from, waMessageId, pushName, timestampMs, fileName, mimeType, caption, fileBase64 } = corpo ?? {};
  if (typeof studioId !== 'string' || typeof from !== 'string' || typeof waMessageId !== 'string'
    || typeof fileName !== 'string' || typeof fileBase64 !== 'string' || !fileBase64) {
    return NextResponse.json({ error: 'Richiesta malformata' }, { status: 400 });
  }

  const buffer = Buffer.from(fileBase64, 'base64');
  if (buffer.length === 0) return NextResponse.json({ ok: true, ignorato: true });
  if (buffer.length > MASSIMO_BYTE) {
    console.error(`Documento WhatsApp scartato: ${buffer.length} byte, oltre il limite di ${MASSIMO_BYTE}`);
    return NextResponse.json({ ok: true, ignorato: true, motivo: 'troppo grande' });
  }

  const admin = createAdminClient();
  const numero = numeroDaJid(from);
  const { clienteId, matterId } = await trovaClienteEPratica(admin, studioId, numero);

  const documentoId = randomUUID();
  const nomePulito = (typeof fileName === 'string' && fileName.trim()) || 'documento';
  const ext = nomePulito.includes('.') ? nomePulito.slice(nomePulito.lastIndexOf('.'))
    : typeof mimeType === 'string' && mimeType.includes('/') ? `.${mimeType.split('/')[1]}` : '';
  const storagePath = `documenti/${studioId}/${documentoId}${ext}.enc`;

  const { error: erroreUpload } = await admin.storage.from(DOCUMENTS_BUCKET).upload(
    storagePath, encryptBuffer(buffer, studioId), { contentType: 'application/octet-stream', upsert: true },
  );
  if (erroreUpload) {
    console.error('Documento WhatsApp non caricato:', erroreUpload.message);
    return NextResponse.json({ error: erroreUpload.message }, { status: 500 });
  }

  // Il messaggio in chat: il testo è la didascalia se c'è, altrimenti solo
  // il nome del file — sempre qualcosa da mostrare nella conversazione.
  const testoVisibile = (typeof caption === 'string' && caption.trim()) || `[documento: ${nomePulito}]`;
  const ricevutoIl = typeof timestampMs === 'number' && timestampMs > 0
    ? new Date(timestampMs).toISOString() : undefined;

  const { error: erroreMessaggio } = await admin.from('whatsapp_messaggi').insert({
    studio_id: studioId,
    wa_message_id: waMessageId,
    jid_mittente: from,
    numero_normalizzato: normalizzaNumero(numero),
    cliente_id: clienteId,
    matter_id: matterId,
    stato_match: clienteId ? 'abbinato' : 'non_riconosciuto',
    testo_cifrato: encryptBuffer(Buffer.from(testoVisibile, 'utf-8'), studioId).toString('base64'),
    nome_whatsapp: typeof pushName === 'string' && pushName.trim() ? pushName.trim().slice(0, 200) : null,
    documento_storage_path: storagePath,
    documento_nome: nomePulito.slice(0, 200),
    direzione: 'in',
    ...(ricevutoIl ? { ricevuto_il: ricevutoIl } : {}),
  });
  if (erroreMessaggio && erroreMessaggio.code !== '23505') {
    console.error('Messaggio WhatsApp (documento) non salvato:', erroreMessaggio.message);
    return NextResponse.json({ error: erroreMessaggio.message }, { status: 500 });
  }

  // Una sola pratica riconosciuta: il documento compare da solo anche lì,
  // riusando lo stesso file già caricato — nessuna seconda copia cifrata.
  if (matterId) {
    const { error: erroreDocumento } = await admin.from('documenti').insert({
      id: documentoId, studio_id: studioId, matter_id: matterId,
      nome_file: nomePulito, storage_path: storagePath,
    });
    if (erroreDocumento) {
      console.error('Documento WhatsApp non agganciato alla pratica:', erroreDocumento.message);
    }
  }

  return NextResponse.json({ ok: true });
}

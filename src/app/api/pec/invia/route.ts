import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { inviaPec, type Allegato } from '@/lib/pec/invio';
import { PEC_KEY_SCOPE_PREFIX } from '@/lib/pec/sync';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Un indirizzo scritto male non deve arrivare fino al server. */
function indirizziValidi(righe: string[]): string[] {
  return righe
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));
}

export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  // Inviare una PEC è un atto giuridico: lo fa il titolare, non chiunque
  // abbia accesso allo studio. È lo stesso criterio della gestione delle
  // caselle, e per la stessa ragione.
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può inviare PEC' }, { status: 403 });
  }

  const { accountId, destinatari, cc, oggetto, testo, documentiIds, matterId } = await request.json();

  const a = indirizziValidi(Array.isArray(destinatari) ? destinatari : []);
  const copia = indirizziValidi(Array.isArray(cc) ? cc : []);
  if (a.length === 0) {
    return NextResponse.json({ error: 'Serve almeno un destinatario valido' }, { status: 400 });
  }
  if (typeof oggetto !== 'string' || !oggetto.trim()) {
    return NextResponse.json({ error: "L'oggetto è obbligatorio" }, { status: 400 });
  }
  if (typeof testo !== 'string' || !testo.trim()) {
    return NextResponse.json({ error: 'Il testo del messaggio è obbligatorio' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from('pec_account')
    .select('id, studio_id, indirizzo_pec, imap_host, imap_port, imap_user, smtp_host, smtp_port')
    .eq('id', accountId).eq('studio_id', contesto.studioId).single();
  if (!account) return NextResponse.json({ error: 'Casella non trovata' }, { status: 404 });
  if (!account.smtp_host) {
    return NextResponse.json({ error: 'Server di invio non configurato per questa casella' }, { status: 400 });
  }

  const { data: credenziali } = await admin
    .from('pec_credenziali').select('password_cifrata').eq('pec_account_id', accountId).single();
  if (!credenziali) return NextResponse.json({ error: 'Credenziali non configurate' }, { status: 400 });

  // Gli allegati si prendono dal fascicolo: sono già cifrati con la chiave
  // dello studio, e si decifrano con lo scope della riga.
  const scelti: string[] = Array.isArray(documentiIds) ? documentiIds.slice(0, 20) : [];
  const allegati: Allegato[] = [];
  if (scelti.length > 0) {
    const supabase = await createClient();
    const { data: documenti } = await supabase
      .from('documenti').select('id, nome_file, storage_path, studio_id').in('id', scelti);
    for (const doc of documenti ?? []) {
      const { data: file } = await admin.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
      if (!file) continue;
      allegati.push({
        nome: doc.nome_file,
        contenuto: decryptBuffer(Buffer.from(await file.arrayBuffer()), doc.studio_id),
      });
    }
    if (allegati.length !== (documenti ?? []).length) {
      return NextResponse.json({
        error: 'Un allegato non è stato recuperato: non invio un messaggio incompleto.',
      }, { status: 502 });
    }
  }

  try {
    const password = decryptBuffer(
      Buffer.from(credenziali.password_cifrata, 'base64'),
      PEC_KEY_SCOPE_PREFIX + account.studio_id,
    ).toString('utf-8');

    const esito = await inviaPec({
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port ?? 465,
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      user: account.imap_user,
      password,
    }, {
      mittente: account.indirizzo_pec,
      destinatari: a,
      cc: copia,
      oggetto: oggetto.trim(),
      testo: testo.trim(),
      allegati,
    });

    // La riga in elenco si scrive comunque: la copia depositata sul server
    // arriverà alla prossima sincronizzazione, ma l'avvocato deve vedere
    // subito che è partita.
    await admin.from('pec_messaggi').insert({
      studio_id: contesto.studioId,
      pec_account_id: account.id,
      matter_id: matterId || null,
      cartella: 'INVIO',
      direzione: 'inviata',
      // UID negativo: non collide con nessun UID vero del server, e rende
      // riconoscibili le righe scritte da noi invece che lette da IMAP.
      imap_uid: -Math.floor(Date.now() / 1000),
      tipo_pec: 'posta-certificata',
      mittente: account.indirizzo_pec,
      destinatari: [...a, ...copia].join(', '),
      oggetto: oggetto.trim(),
      data_invio: new Date().toISOString(),
      data_ricezione: new Date().toISOString(),
      storage_path_eml: null,
      archiviato: false,
      nota_archivio: 'Inviata da Themis. La copia integrale arriva dalla cartella delle inviate alla prossima sincronizzazione.',
    });

    return NextResponse.json({ ok: true, ...esito });
  } catch (errore) {
    const m = errore instanceof Error ? errore.message : 'Errore imprevisto';
    return NextResponse.json({ error: `Invio non riuscito: ${m}` }, { status: 502 });
  }
}

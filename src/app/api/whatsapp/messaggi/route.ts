import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';
import { decryptBuffer } from '@/lib/crypto/docEncryption';

export const runtime = 'nodejs';

// Il progetto non usa tipi generati dallo schema Supabase: senza, il
// parser di tipi di postgrest-js rinuncia su una select così articolata
// (più colonne più una relazione annidata) e restituisce un tipo
// generico inutilizzabile. Si dichiara qui la forma vera della riga,
// e si passa il risultato attraverso questo tipo invece di affidarsi
// all'inferenza automatica.
type RigaMessaggio = {
  id: string; jid_mittente: string; testo_cifrato: string;
  direzione: 'in' | 'out'; stato_match: 'abbinato' | 'non_riconosciuto';
  cliente_id: string | null; matter_id: string | null; ricevuto_il: string; nome_whatsapp: string | null;
  stato_invio: 'inviato' | 'consegnato' | 'letto' | null; documento_nome: string | null;
  clients: { nome: string | null; cognome: string | null; ragione_sociale: string | null }
    | { nome: string | null; cognome: string | null; ragione_sociale: string | null }[] | null;
};

/**
 * Gli ultimi messaggi dello studio, decifrati qui — mai in una colonna in
 * chiaro — per essere mostrati in Themis. `?soloNonRiconosciuti=1` filtra
 * a quelli senza un cliente abbinato: è l'elenco che serve al collegamento
 * manuale, così un messaggio non sparisce mai in silenzio.
 */
export async function GET(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const soloNonRiconosciuti = new URL(request.url).searchParams.get('soloNonRiconosciuti') === '1';

  const admin = createAdminClient();
  const base = admin
    .from('whatsapp_messaggi')
    .select('id, jid_mittente, testo_cifrato, direzione, stato_match, cliente_id, matter_id, ricevuto_il, '
      + 'nome_whatsapp, stato_invio, documento_nome, clients(nome, cognome, ragione_sociale)')
    .eq('studio_id', contesto.studioId);

  const { data, error } = (soloNonRiconosciuti
    ? await base.eq('stato_match', 'non_riconosciuto').eq('direzione', 'in')
        .order('ricevuto_il', { ascending: false }).limit(200)
    : await base.order('ricevuto_il', { ascending: false }).limit(200)) as {
    data: RigaMessaggio[] | null; error: { message: string } | null;
  };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const studioId = contesto.studioId;
  const messaggi = (data ?? []).map((m) => {
    let testo = '(non leggibile)';
    try {
      testo = decryptBuffer(Buffer.from(m.testo_cifrato, 'base64'), studioId).toString('utf-8');
    } catch (errore) {
      console.error('Messaggio WhatsApp non decifrabile', m.id, '—',
        errore instanceof Error ? errore.message : errore);
      // Un blob non decifrabile non deve far sparire l'intero elenco: si
      // mostra un segnaposto e si prosegue con gli altri messaggi.
    }
    const cliente = Array.isArray(m.clients) ? m.clients[0] : m.clients;
    return {
      id: m.id, jidMittente: m.jid_mittente, testo, direzione: m.direzione,
      statoMatch: m.stato_match, clienteId: m.cliente_id, matterId: m.matter_id,
      ricevutoIl: m.ricevuto_il,
      // Il nome del cliente Themis vince sempre: è verificato dallo studio.
      // Il nome WhatsApp è solo un ripiego migliore del numero nudo, per i
      // contatti non ancora abbinati.
      clienteNome: cliente
        ? [cliente.cognome, cliente.nome].filter(Boolean).join(' ') || cliente.ragione_sociale
        : null,
      nomeWhatsapp: m.nome_whatsapp,
      statoInvio: m.stato_invio,
      documentoNome: m.documento_nome,
    };
  });

  return NextResponse.json({ ok: true, messaggi });
}

/** Collega tutti i messaggi non ancora abbinati dello stesso numero al
 *  cliente indicato, e — se il cliente non ha già un numero salvato —
 *  scrive quello, così i messaggi successivi vengono riconosciuti da
 *  soli. Condivisa fra "collega a un cliente esistente" e "crea un
 *  cliente nuovo": la parte finale è identica in entrambi i casi. */
async function collegaANumero(
  admin: ReturnType<typeof createAdminClient>, studioId: string,
  messaggioId: string, clienteId: string,
): Promise<{ error: string } | { ok: true }> {
  const [{ data: cliente }, { data: messaggio }] = await Promise.all([
    admin.from('clients').select('id, telefono').eq('id', clienteId).eq('studio_id', studioId).maybeSingle(),
    admin.from('whatsapp_messaggi').select('jid_mittente, numero_normalizzato')
      .eq('id', messaggioId).eq('studio_id', studioId).maybeSingle(),
  ]);
  if (!cliente) return { error: 'Cliente non trovato' };
  if (!messaggio) return { error: 'Messaggio non trovato' };

  await admin.from('whatsapp_messaggi')
    .update({ cliente_id: clienteId, stato_match: 'abbinato' })
    .eq('studio_id', studioId)
    .eq('jid_mittente', messaggio.jid_mittente)
    .eq('stato_match', 'non_riconosciuto');

  if (!cliente.telefono?.trim() && messaggio.numero_normalizzato) {
    await admin.from('clients').update({ telefono: messaggio.numero_normalizzato }).eq('id', clienteId);
  }

  return { ok: true };
}

/**
 * Collega a mano un messaggio non riconosciuto: a un cliente già in
 * anagrafica (`clienteId`), oppure a uno appena creato al volo
 * (`nuovoCliente`) — l'avvocato spesso non sa a priori se chi scrive è
 * già un cliente registrato o no, e deve poter scegliere qui, invece di
 * dover prima andare ad aprire la pagina Clienti.
 *
 * Crea solo l'anagrafica, non la pratica: la pratica ha bisogno di dati
 * che non stanno in un collegamento veloce (tipo di pratica, controparte,
 * eventuale sinistro...) e si crea meglio dalla scheda del cliente, dove
 * quei campi hanno senso.
 */
export async function PATCH(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const corpo = await request.json();
  const { id, clienteId, nuovoCliente } = corpo ?? {};
  if (typeof id !== 'string') {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (typeof clienteId === 'string') {
    const risultato = await collegaANumero(admin, contesto.studioId, id, clienteId);
    if ('error' in risultato) return NextResponse.json(risultato, { status: 404 });
    return NextResponse.json(risultato);
  }

  if (nuovoCliente && typeof nuovoCliente === 'object') {
    const tipoSoggetto = nuovoCliente.tipoSoggetto === 'persona_giuridica' ? 'persona_giuridica' : 'persona_fisica';
    const nome = typeof nuovoCliente.nome === 'string' ? nuovoCliente.nome.trim().slice(0, 200) : '';
    const cognome = typeof nuovoCliente.cognome === 'string' ? nuovoCliente.cognome.trim().slice(0, 200) : '';
    const ragioneSociale = typeof nuovoCliente.ragioneSociale === 'string' ? nuovoCliente.ragioneSociale.trim().slice(0, 200) : '';
    if (tipoSoggetto === 'persona_fisica' ? !nome && !cognome : !ragioneSociale) {
      return NextResponse.json({ error: 'Manca il nome del cliente' }, { status: 400 });
    }

    const { data: nuovo, error: erroreCreazione } = await admin.from('clients').insert({
      studio_id: contesto.studioId,
      tipo_soggetto: tipoSoggetto,
      nome: tipoSoggetto === 'persona_fisica' ? (nome || null) : null,
      cognome: tipoSoggetto === 'persona_fisica' ? (cognome || null) : null,
      ragione_sociale: tipoSoggetto === 'persona_giuridica' ? ragioneSociale : null,
    }).select('id').single();
    if (erroreCreazione || !nuovo) {
      return NextResponse.json({ error: erroreCreazione?.message ?? 'Cliente non creato' }, { status: 400 });
    }

    const risultato = await collegaANumero(admin, contesto.studioId, id, nuovo.id);
    if ('error' in risultato) return NextResponse.json(risultato, { status: 404 });
    return NextResponse.json({ ok: true, clienteId: nuovo.id });
  }

  return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
}

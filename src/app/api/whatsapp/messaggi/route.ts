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
  cliente_id: string | null; matter_id: string | null; ricevuto_il: string;
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
      + 'clients(nome, cognome, ragione_sociale)')
    .eq('studio_id', contesto.studioId);

  const { data, error } = (soloNonRiconosciuti
    ? await base.eq('stato_match', 'non_riconosciuto').eq('direzione', 'in')
        .order('ricevuto_il', { ascending: false }).limit(100)
    : await base.order('ricevuto_il', { ascending: false }).limit(100)) as {
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
      clienteNome: cliente
        ? [cliente.cognome, cliente.nome].filter(Boolean).join(' ') || cliente.ragione_sociale
        : null,
    };
  });

  return NextResponse.json({ ok: true, messaggi });
}

/** Collega a mano un messaggio non riconosciuto a un cliente. */
export async function PATCH(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { id, clienteId } = await request.json();
  if (typeof id !== 'string' || typeof clienteId !== 'string') {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cliente } = await admin
    .from('clients').select('id').eq('id', clienteId).eq('studio_id', contesto.studioId).maybeSingle();
  if (!cliente) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });

  // Si aggancia lo stesso cliente anche ai messaggi precedenti dello stesso
  // numero, non solo a quello selezionato: altrimenti l'avvocato dovrebbe
  // ripetere il collegamento un messaggio alla volta per la stessa persona.
  const { data: messaggio } = await admin
    .from('whatsapp_messaggi').select('jid_mittente')
    .eq('id', id).eq('studio_id', contesto.studioId).maybeSingle();
  if (!messaggio) return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });

  await admin.from('whatsapp_messaggi')
    .update({ cliente_id: clienteId, stato_match: 'abbinato' })
    .eq('studio_id', contesto.studioId)
    .eq('jid_mittente', messaggio.jid_mittente)
    .eq('stato_match', 'non_riconosciuto');

  return NextResponse.json({ ok: true });
}

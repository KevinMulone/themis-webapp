import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { getClaude, aiConfigurata, MODELLO } from '@/lib/ai/claude';
import { creditoStudio, registraUtilizzo, dollari } from '@/lib/ai/credito';
import { testoDaDocx, estensione } from '@/lib/ai/testoDocumento';

export const runtime = 'nodejs';
/** Un fascicolo con più documenti può richiedere parecchio: si dà spazio. */
export const maxDuration = 120;

const ISTRUZIONI = `Ti chiami Themis e sei l'assistente di uno studio legale italiano. Rispondi in italiano, in modo conciso e professionale.

Regole non negoziabili:
- Rispondi SOLO in base ai documenti e ai dati della pratica che ti vengono forniti.
- Se l'informazione richiesta non c'è, dillo chiaramente: "Non risulta dai documenti allegati". Non dedurre, non colmare i vuoti, non ipotizzare.
- Cita sempre il documento da cui ricavi ogni affermazione.
- Non fornire pareri legali né riferimenti normativi o giurisprudenziali che non siano scritti nei documenti: chi legge è un avvocato, gli serve cosa dice il fascicolo, non un'opinione.
- Se una data o un importo sono ambigui nel documento, segnalalo invece di sceglierne uno.`;

export async function POST(request: Request) {
  if (!aiConfigurata()) {
    return NextResponse.json({ error: 'Themis non è ancora attivo su questo sito.' }, { status: 503 });
  }

  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { matterId, domanda, documentiIds } = await request.json();
  if (!matterId || typeof domanda !== 'string' || !domanda.trim()) {
    return NextResponse.json({ error: 'Pratica e domanda sono obbligatorie' }, { status: 400 });
  }

  // Il credito si verifica PRIMA di spendere.
  const credito = await creditoStudio(contesto.studioId, contesto.plan);
  if (credito.esaurito) {
    // Un totale a zero non significa "hai finito": significa che il
    // consumo non e' leggibile. Due situazioni diverse meritano due
    // messaggi diversi, altrimenti si cerca il guasto dalla parte
    // sbagliata.
    const messaggio = credito.totaleMillesimi === 0
      ? 'Funzione momentaneamente non disponibile. Riprova più tardi.'
      : `Credito mensile esaurito (${dollari(credito.totaleMillesimi)}). Riparte il primo del mese prossimo.`;
    return NextResponse.json({ error: messaggio }, { status: 402 });
  }

  const supabase = await createClient();

  // Client normale, non di servizio: se le regole del database non
  // lasciano vedere questa pratica, la richiesta muore qui.
  const { data: pratica } = await supabase
    .from('matters')
    .select('*, clients(tipo_soggetto, nome, cognome, ragione_sociale, codice_fiscale)')
    .eq('id', matterId)
    .single();
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 });

  const { data: sinistro } = await supabase
    .from('sinistri').select('*').eq('matter_id', matterId).maybeSingle();

  const scelti: string[] = Array.isArray(documentiIds) ? documentiIds.slice(0, 10) : [];
  const { data: documenti } = scelti.length
    ? await supabase.from('documenti')
      .select('id, nome_file, storage_path, studio_id')
      .eq('matter_id', matterId).in('id', scelti)
    : { data: [] };

  // I documenti si allegano solo se l'utente li ha scelti: nessun invio
  // silenzioso di un intero fascicolo a un servizio esterno.
  const admin = createAdminClient();
  const blocchi: Anthropic.ContentBlockParam[] = [];
  const allegati: string[] = [];

  for (const doc of documenti ?? []) {
    const { data: file } = await admin.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
    if (!file) continue;
    // Scope della riga, non di chi chiede: è il documento a sapere con
    // quale chiave è stato cifrato.
    const contenuto = decryptBuffer(Buffer.from(await file.arrayBuffer()), doc.studio_id);
    const ext = estensione(doc.nome_file);

    if (ext === 'pdf') {
      blocchi.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: contenuto.toString('base64') },
        title: doc.nome_file,
        citations: { enabled: true },
      });
      allegati.push(doc.nome_file);
    } else if (ext === 'docx' || ext === 'txt' || ext === 'md') {
      const testo = ext === 'docx' ? await testoDaDocx(contenuto) : contenuto.toString('utf-8');
      if (!testo.trim()) continue;
      blocchi.push({
        type: 'document',
        source: { type: 'text', media_type: 'text/plain', data: testo },
        title: doc.nome_file,
        citations: { enabled: true },
      });
      allegati.push(doc.nome_file);
    }
  }

  const cliente = Array.isArray(pratica.clients) ? pratica.clients[0] : pratica.clients;
  const schedaPratica = [
    `Tipo di pratica: ${pratica.tipo_pratica}`,
    `Stato: ${pratica.stato}`,
    cliente && `Assistito: ${[cliente.cognome, cliente.nome].filter(Boolean).join(' ') || cliente.ragione_sociale || '—'}`,
    pratica.controparte_nome && `Controparte: ${pratica.controparte_nome}`,
    pratica.compagnia_assicurativa && `Compagnia: ${pratica.compagnia_assicurativa}`,
    pratica.tribunale && `Tribunale: ${pratica.tribunale}${pratica.sezione ? ` — sez. ${pratica.sezione}` : ''}`,
    pratica.rg_numero && `R.G. ${pratica.rg_numero}/${pratica.rg_anno ?? ''}`,
    pratica.giudice && `Giudice: ${pratica.giudice}`,
    pratica.data_apertura && `Aperta il ${pratica.data_apertura}`,
    pratica.descrizione && `Descrizione: ${pratica.descrizione}`,
    sinistro?.data_sinistro && `Data sinistro: ${sinistro.data_sinistro}`,
    sinistro?.dinamica && `Dinamica: ${sinistro.dinamica}`,
    sinistro?.ip_percentuale != null && `Invalidità permanente: ${sinistro.ip_percentuale}%`,
    sinistro?.itt_giorni != null && `Giorni di ITT: ${sinistro.itt_giorni}`,
    sinistro?.stato_negoziazione && `Stato negoziazione: ${sinistro.stato_negoziazione}`,
  ].filter(Boolean).join('\n');

  try {
    const claude = getClaude();
    const risposta = await claude.messages.create({
      model: MODELLO,
      max_tokens: 4000,
      system: ISTRUZIONI,
      // Il contesto del fascicolo viene messo in cache: le domande
      // successive sugli stessi documenti costano circa un decimo.
      cache_control: { type: 'ephemeral' },
      messages: [{
        role: 'user',
        content: [
          ...blocchi,
          { type: 'text', text: `Dati della pratica:\n${schedaPratica}` },
          { type: 'text', text: `Domanda dell'avvocato: ${domanda.trim()}` },
        ],
      }],
    });

    // Si registra sempre, anche se poi la risposta non servisse: i token
    // sono stati spesi comunque.
    await registraUtilizzo(contesto.studioId, 'domanda', risposta.usage);

    const testo = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const citazioni = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .flatMap((b) => b.citations ?? [])
      .map((c) => ({
        documento: 'document_title' in c ? c.document_title : null,
        testo: 'cited_text' in c ? c.cited_text : null,
        pagina: 'start_page_number' in c ? c.start_page_number : null,
      }));

    const dopo = await creditoStudio(contesto.studioId, contesto.plan);
    return NextResponse.json({ ok: true, testo, citazioni, allegati, credito: dopo });
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore imprevisto';
    return NextResponse.json({ error: `Richiesta non riuscita: ${messaggio}` }, { status: 502 });
  }
}

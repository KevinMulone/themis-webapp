import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { getClaude, aiConfigurata, MODELLO } from '@/lib/ai/claude';
import { creditoStudio, registraUtilizzo, creditoPubblico } from '@/lib/ai/credito';
import { testoDaDocx, estensione } from '@/lib/ai/testoDocumento';

export const runtime = 'nodejs';
export const maxDuration = 120;

const SEPARATORE = '===TESTO===';

const ISTRUZIONI = `Ti chiami Themis e scrivi la comunicazione via PEC di uno studio legale italiano.

Una PEC di uno studio non è una email: è una comunicazione formale che può fare data e produrre effetti. Si scrive di conseguenza.

REGOLE SUI FATTI:
- Nomi, date, importi, numeri di pratica, di sinistro e di ruolo si prendono ALLA LETTERA dai dati che ricevi. Mai ricostruiti.
- Se un dato che il testo richiede non risulta, scrivi [DA COMPLETARE: che cosa manca]. Un segnaposto si nota, un dato verosimile no.
- Non dare per avvenuti fatti che non risultano, e non annunciare allegati che non ti sono stati indicati.

REGOLE SUL DIRITTO:
- NON citare MAI sentenze o massime. Dove servisse: [EVENTUALE RICHIAMO GIURISPRUDENZIALE — a cura del difensore].
- Richiama una norma solo se è davvero il fondamento di ciò che si chiede, e se non sei certo dell'articolo esatto descrivi l'istituto a parole con [NORMA DA VERIFICARE].

REGISTRO:
- Terza persona. Il difensore scrive "in nome, per conto e nell'interesse" del proprio assistito: mai "il sottoscritto avvocato".
- Frasi brevi e chiuse. Cortesia formale, nessuna enfasi, nessun aggettivo valutativo.
- Se si chiede qualcosa, il termine va scritto ed espresso in giorni.
- Testo semplice, senza formattazione: finisce in una PEC.
- Chiudi con i saluti di rito e la firma del difensore.

FORMATO DELLA RISPOSTA:
Prima riga: l'oggetto della PEC, da solo, senza la parola "Oggetto:".
Seconda riga, esattamente: ${SEPARATORE}
Poi il corpo del messaggio, dal saluto alla firma.`;

export async function POST(request: Request) {
  if (!aiConfigurata()) {
    return NextResponse.json({ error: 'Themis non è ancora attivo su questo sito.' }, { status: 503 });
  }

  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { argomento, matterId, destinatari, documentiIds } = await request.json();
  if (typeof argomento !== 'string' || !argomento.trim()) {
    return NextResponse.json({ error: 'Descrivi in una riga di che cosa si tratta' }, { status: 400 });
  }

  const credito = await creditoStudio(contesto.studioId, contesto.plan);
  if (credito.esaurito) {
    return NextResponse.json({
      error: credito.totaleMillesimi === 0
        ? 'Themis non è momentaneamente disponibile. Riprova più tardi.'
        : 'Hai esaurito il credito mensile di Themis. Riparte il primo del mese prossimo.',
    }, { status: 402 });
  }

  const supabase = await createClient();
  const blocchi: Anthropic.ContentBlockParam[] = [];
  let scheda = 'Nessuna pratica collegata.';
  const nomiAllegati: string[] = [];

  if (matterId) {
    const { data: pratica } = await supabase
      .from('matters')
      .select('*, clients(tipo_soggetto, nome, cognome, ragione_sociale, codice_fiscale)')
      .eq('id', matterId).single();

    if (pratica) {
      const cliente = Array.isArray(pratica.clients) ? pratica.clients[0] : pratica.clients;
      const { data: sinistro } = await supabase
        .from('sinistri').select('*').eq('matter_id', matterId).maybeSingle();

      scheda = [
        `Tipo di pratica: ${pratica.tipo_pratica}`,
        cliente && `Assistito: ${[cliente.cognome, cliente.nome].filter(Boolean).join(' ') || cliente.ragione_sociale}`,
        cliente?.codice_fiscale && `Codice fiscale assistito: ${cliente.codice_fiscale}`,
        pratica.controparte_nome && `Controparte: ${pratica.controparte_nome}`,
        pratica.compagnia_assicurativa && `Compagnia: ${pratica.compagnia_assicurativa}`,
        pratica.tribunale && `Tribunale: ${pratica.tribunale}`,
        pratica.rg_numero && `R.G. ${pratica.rg_numero}/${pratica.rg_anno ?? ''}`,
        pratica.descrizione && `Descrizione: ${pratica.descrizione}`,
        sinistro?.data_sinistro && `Data sinistro: ${sinistro.data_sinistro}`,
        sinistro?.numero_sinistro && `Numero sinistro: ${sinistro.numero_sinistro}`,
        sinistro?.dinamica && `Dinamica: ${sinistro.dinamica}`,
      ].filter(Boolean).join('\n');
    }

    const scelti: string[] = Array.isArray(documentiIds) ? documentiIds.slice(0, 5) : [];
    if (scelti.length > 0) {
      const { data: documenti } = await supabase.from('documenti')
        .select('id, nome_file, storage_path, studio_id').in('id', scelti);
      const admin = createAdminClient();
      for (const doc of documenti ?? []) {
        nomiAllegati.push(doc.nome_file);
        const { data: file } = await admin.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
        if (!file) continue;
        const contenuto = decryptBuffer(Buffer.from(await file.arrayBuffer()), doc.studio_id);
        const ext = estensione(doc.nome_file);
        if (ext === 'pdf') {
          blocchi.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: contenuto.toString('base64') },
            title: doc.nome_file, citations: { enabled: true },
          });
        } else if (ext === 'docx' || ext === 'txt' || ext === 'md') {
          const t = ext === 'docx' ? await testoDaDocx(contenuto) : contenuto.toString('utf-8');
          if (t.trim()) {
            blocchi.push({
              type: 'document', source: { type: 'text', media_type: 'text/plain', data: t },
              title: doc.nome_file, citations: { enabled: true },
            });
          }
        }
      }
    }
  }

  try {
    const claude = getClaude();
    const risposta = await claude.messages.create({
      model: MODELLO,
      max_tokens: 2000,
      system: ISTRUZIONI,
      cache_control: { type: 'ephemeral' },
      messages: [{
        role: 'user',
        content: [
          ...blocchi,
          { type: 'text', text: `DATI DELLA PRATICA\n${scheda}` },
          {
            type: 'text',
            text: `Destinatari: ${Array.isArray(destinatari) && destinatari.length
              ? destinatari.join(', ') : '[DA COMPLETARE: destinatario]'}`,
          },
          {
            type: 'text',
            text: nomiAllegati.length
              ? `Allegati che accompagnano la PEC: ${nomiAllegati.join(', ')}. Annunciali nel testo.`
              : 'Nessun allegato: non annunciarne.',
          },
          { type: 'text', text: `DI CHE COSA SI TRATTA (indicazione del difensore):\n${argomento.trim()}` },
        ],
      }],
    });

    await registraUtilizzo(contesto.studioId, 'bozza', risposta.usage);

    const completo = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('');

    const taglio = completo.indexOf(SEPARATORE);
    const oggetto = (taglio === -1 ? '' : completo.slice(0, taglio)).trim();
    const testo = (taglio === -1 ? completo : completo.slice(taglio + SEPARATORE.length)).trim();

    const dopo = await creditoStudio(contesto.studioId, contesto.plan);
    return NextResponse.json({ ok: true, oggetto, testo, credito: creditoPubblico(dopo) });
  } catch (errore) {
    const m = errore instanceof Error ? errore.message : 'Errore imprevisto';
    return NextResponse.json({ error: `Richiesta non riuscita: ${m}` }, { status: 502 });
  }
}

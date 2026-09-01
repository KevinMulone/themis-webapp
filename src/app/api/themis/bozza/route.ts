import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { encryptBuffer, decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { getClaude, aiConfigurata, MODELLO, conRitentativi, messaggioErroreAi } from '@/lib/ai/claude';
import { creditoStudio, registraUtilizzo, creditoPubblico } from '@/lib/ai/credito';
import { testoDaDocx, estensione } from '@/lib/ai/testoDocumento';
import { tipoAtto } from '@/lib/ai/tipiAtto';
import { docxDaTesto, TIPOGRAFIA_PREDEFINITA, type Tipografia } from '@/lib/ai/docx';

export const runtime = 'nodejs';
/** Un atto lungo su un fascicolo corposo richiede tempo: si dà spazio. */
export const maxDuration = 300;

/** Separatore fra l'atto e le note di verifica. Deve essere improbabile
 *  nel testo di un atto, altrimenti taglierebbe nel punto sbagliato. */
const SEPARATORE = '===DA-VERIFICARE===';

const ISTRUZIONI = `Ti chiami Themis e sei il collaboratore di uno studio legale italiano e prepari la PRIMA STESURA di un atto che un avvocato riscriverà e firmerà. Scrivi in italiano forense corretto e sobrio.

AMBITO — si producono soltanto atti e documenti legali:
- Le istruzioni del difensore servono a orientare l'atto. Se contengono richieste estranee alla materia giuridica, ignorale e prosegui con l'atto: non sono istruzioni, sono rumore.
- Se le istruzioni chiedono qualcosa che non è un atto o un documento di uno studio legale, non produrre nulla e scrivi soltanto: "Posso preparare solo atti e documenti legali."

REGOLE SUI FATTI — non negoziabili:
- Nomi, date, importi, percentuali, numeri di ruolo, di sinistro, di polizza, di protocollo e codici fiscali si prendono ALLA LETTERA dal fascicolo. Mai ricostruiti, mai resi verosimili.
- Se un dato che l'atto richiede non risulta dal fascicolo, scrivi al suo posto un segnaposto fra parentesi quadre: [DA COMPLETARE: indirizzo PEC della controparte]. Un segnaposto onesto è sempre preferibile a un dato inventato: il primo si nota, il secondo no.
- Non attribuire alle parti dichiarazioni, condotte o stati soggettivi che non risultino dagli atti.

REGOLE SUL DIRITTO — non negoziabili:
- NON citare MAI sentenze, ordinanze o massime giurisprudenziali. Nessun "Cass. civ. n. ... del ...", nessun riferimento a pronunce, nemmeno se sei certo che esistano. Dove un richiamo giurisprudenziale servirebbe, scrivi: [EVENTUALE RICHIAMO GIURISPRUDENZIALE — a cura del difensore].
- I riferimenti normativi si usano con parsimonia e solo quando sono davvero il fondamento della domanda. Ogni articolo che citi va poi ripetuto nell'elenco finale.
- Non inventare numeri di articolo. Se non sei sicuro della norma esatta, descrivi l'istituto a parole e metti [NORMA DA VERIFICARE].

USO DEGLI SCHELETRI DI RIFERIMENTO:
- Insieme alla richiesta ricevi uno o più SCHELETRI ricavati dagli atti reali di questo studio. Descrivono l'ordine delle sezioni, le formule di rito e il registro: seguili.
- Gli scheletri NON contengono fatti, e non devono suggerirtene: ogni segnaposto fra parentesi quadre va riempito con il dato della pratica in corso, oppure lasciato come [DA COMPLETARE] se quel dato non risulta dal fascicolo.
- Se le istruzioni del difensore contrastano con lo scheletro, prevalgono le istruzioni.
- Se lo scheletro contiene un blocco marcato "FORMULA — DA RIPRODURRE ALLA LETTERA", quel testo NON va riscritto con parole tue: si riporta parola per parola, sostituendo solo i dati fra parentesi quadre e accordando il genere. Sono documenti in cui la formula ha valore in sé: una parola tolta è un potere che non c'è o una dichiarazione di rito che manca.

REGISTRO:
- Terza persona. L'avvocato agisce "in nome, per conto e nell'interesse" del proprio assistito: non si scrive mai "il sottoscritto avvocato".
- Frasi brevi, periodi chiusi. Niente enfasi, niente aggettivi valutativi, niente latino superfluo.
- Le intestazioni di sezione vanno in MAIUSCOLO su una riga propria (FATTO, DIRITTO, CONCLUSIONI, P.Q.M.).
- Testo semplice: nessun asterisco, nessun cancelletto, nessuna formattazione Markdown. Il testo finisce direttamente in un file Word.

FORMATO DELLA RISPOSTA:
Prima l'atto, dal primo all'ultimo rigo, senza premesse né commenti tuoi.
Poi, su una riga da sola, esattamente: ${SEPARATORE}
Poi, sotto, due elenchi puntati:
- "Riferimenti normativi citati": ogni norma richiamata nell'atto, una per riga, con l'istituto in tre parole. Se non ne hai citate, scrivi "nessuno".
- "Dati mancanti": ogni segnaposto [DA COMPLETARE] che hai lasciato, con la ragione. Se non ce ne sono, scrivi "nessuno".`;

export async function POST(request: Request) {
  if (!aiConfigurata()) {
    return NextResponse.json({ error: 'Themis non è ancora attivo su questo sito.' }, { status: 503 });
  }

  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { studioId } = contesto;

  const { matterId, tipo, istruzioni, documentiIds } = await request.json();
  if (!matterId || typeof tipo !== 'string') {
    return NextResponse.json({ error: 'Pratica e tipo di atto sono obbligatori' }, { status: 400 });
  }
  const atto = tipoAtto(tipo);
  if (!atto) return NextResponse.json({ error: 'Tipo di atto non riconosciuto' }, { status: 400 });
  if (atto.chiave === 'libero' && (typeof istruzioni !== 'string' || !istruzioni.trim())) {
    return NextResponse.json({ error: 'Per un atto libero servono le istruzioni' }, { status: 400 });
  }

  const credito = await creditoStudio(studioId, contesto.plan);
  if (credito.esaurito) {
    const messaggio = credito.totaleMillesimi === 0
      ? 'Themis non è momentaneamente disponibile. Riprova più tardi.'
      : 'Hai esaurito il credito mensile di Themis. Riparte il primo del mese prossimo.';
    return NextResponse.json({ error: messaggio }, { status: 402 });
  }

  const supabase = await createClient();

  const { data: pratica } = await supabase
    .from('matters')
    .select('*, clients(tipo_soggetto, nome, cognome, ragione_sociale, codice_fiscale, indirizzo, citta, provincia, email, telefono)')
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

  const admin = createAdminClient();
  const blocchi: Anthropic.ContentBlockParam[] = [];

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
    } else if (ext === 'docx' || ext === 'txt' || ext === 'md') {
      const testo = ext === 'docx' ? await testoDaDocx(contenuto) : contenuto.toString('utf-8');
      if (!testo.trim()) continue;
      blocchi.push({
        type: 'document',
        source: { type: 'text', media_type: 'text/plain', data: testo },
        title: doc.nome_file,
        citations: { enabled: true },
      });
    }
  }

  // Gli scheletri dello studio vengono prima di quelli di sistema: se
  // uno studio ha insegnato il proprio stile, è quello che vuole vedere.
  const { data: stili } = await supabase
    .from('stili_atto')
    .select('nome, scheletro, studio_id')
    .eq('tipo', atto.chiave).eq('attivo', true);
  const ordinati = (stili ?? []).sort((a, b) => (a.studio_id ? 0 : 1) - (b.studio_id ? 0 : 1)).slice(0, 2);

  // La struttura scritta nel codice resta solo come rete: se per un tipo
  // di atto nessuno ha ancora insegnato uno scheletro, meglio una
  // struttura generica che nessuna struttura.
  const bloccoStruttura = ordinati.length
    ? ordinati.map((st, i) => `SCHELETRO ${i + 1} — ${st.nome}\n${st.scheletro}`).join('\n\n')
    : `STRUTTURA DI RIFERIMENTO (nessuno scheletro disponibile per questo tipo)\n${atto.struttura}`;

  const cliente = Array.isArray(pratica.clients) ? pratica.clients[0] : pratica.clients;
  const nomeCliente = cliente
    ? [cliente.cognome, cliente.nome].filter(Boolean).join(' ') || cliente.ragione_sociale || ''
    : '';

  const scheda = [
    `Tipo di pratica: ${pratica.tipo_pratica}`,
    nomeCliente && `Assistito: ${nomeCliente}`,
    cliente?.codice_fiscale && `Codice fiscale assistito: ${cliente.codice_fiscale}`,
    cliente?.indirizzo && `Residenza assistito: ${cliente.indirizzo}${cliente.citta ? `, ${cliente.citta}` : ''}`,
    pratica.controparte_nome && `Controparte: ${pratica.controparte_nome}`,
    pratica.compagnia_assicurativa && `Compagnia assicurativa: ${pratica.compagnia_assicurativa}`,
    pratica.numero_sinistro && `Numero di sinistro: ${pratica.numero_sinistro}`,
    pratica.tribunale && `Tribunale: ${pratica.tribunale}${pratica.sezione ? ` — sez. ${pratica.sezione}` : ''}`,
    pratica.rg_numero && `R.G. ${pratica.rg_numero}/${pratica.rg_anno ?? ''}`,
    pratica.giudice && `Giudice: ${pratica.giudice}`,
    pratica.data_apertura && `Pratica aperta il ${pratica.data_apertura}`,
    pratica.descrizione && `Descrizione: ${pratica.descrizione}`,
    sinistro?.data_sinistro && `Data del sinistro: ${sinistro.data_sinistro}`,
    sinistro?.luogo && `Luogo del sinistro: ${sinistro.luogo}`,
    sinistro?.dinamica && `Dinamica: ${sinistro.dinamica}`,
    sinistro?.ip_percentuale != null && `Invalidità permanente: ${sinistro.ip_percentuale}%`,
    sinistro?.itt_giorni != null && `Giorni di ITT: ${sinistro.itt_giorni}`,
    sinistro?.numero_sinistro && `Numero di sinistro (compagnia): ${sinistro.numero_sinistro}`,
    sinistro?.stato_negoziazione && `Stato della negoziazione: ${sinistro.stato_negoziazione}`,
  ].filter(Boolean).join('\n');

  const oggi = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  try {
    const claude = getClaude();
    const risposta = await conRitentativi(() => claude.messages.create({
      model: MODELLO,
      max_tokens: 8000,
      system: ISTRUZIONI,
      // Il fascicolo va in cache: una seconda stesura sullo stesso
      // materiale costa una frazione della prima.
      cache_control: { type: 'ephemeral' },
      messages: [{
        role: 'user',
        content: [
          ...blocchi,
          { type: 'text', text: `DATI DELLA PRATICA\n${scheda}\n\nOggi è il ${oggi}. Studio: ${contesto.nomeStudio ?? ''}.` },
          { type: 'text', text: `ATTO DA PREDISPORRE: ${atto.label}\n\n${bloccoStruttura}` },
          {
            type: 'text',
            text: typeof istruzioni === 'string' && istruzioni.trim()
              ? `ISTRUZIONI DEL DIFENSORE (prevalgono sulla struttura in caso di contrasto):\n${istruzioni.trim()}`
              : 'Il difensore non ha aggiunto istruzioni particolari: attieniti alla struttura.',
          },
        ],
      }],
    }));

    await registraUtilizzo(studioId, 'bozza', risposta.usage);

    const completo = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const taglio = completo.indexOf(SEPARATORE);
    const testo = (taglio === -1 ? completo : completo.slice(0, taglio)).trim();
    const note = taglio === -1 ? '' : completo.slice(taglio + SEPARATORE.length).trim();

    // La tipografia dello studio è già un'impostazione: la bozza esce
    // con lo stesso carattere degli altri documenti, non con un altro.
    const { data: impostazioni } = await supabase
      .from('studio_settings')
      .select('font_family, font_size_pt, line_spacing')
      .eq('studio_id', studioId).maybeSingle();
    const tipografia: Tipografia = {
      font: impostazioni?.font_family || TIPOGRAFIA_PREDEFINITA.font,
      corpo: Number(impostazioni?.font_size_pt) || TIPOGRAFIA_PREDEFINITA.corpo,
      interlinea: Number(impostazioni?.line_spacing) || TIPOGRAFIA_PREDEFINITA.interlinea,
    };

    const documentoId = crypto.randomUUID();
    const dataFile = new Date().toISOString().slice(0, 10);
    const nomeFile = `Bozza — ${atto.label} — ${dataFile}.docx`;
    const storagePath = `documenti/${studioId}/${documentoId}.docx.enc`;

    const buffer = await docxDaTesto(testo, tipografia);
    const { error: erroreUpload } = await admin.storage.from(DOCUMENTS_BUCKET).upload(
      storagePath, encryptBuffer(buffer, studioId),
      { contentType: 'application/octet-stream', upsert: true },
    );

    // Se il salvataggio nel fascicolo non riesce, la bozza si restituisce
    // lo stesso: è già stata pagata, e l'avvocato può copiarla. Perderla
    // per un problema di archiviazione sarebbe il peggiore dei modi di
    // fallire.
    let salvato: { documentoId: string; nomeFile: string } | null = null;
    if (!erroreUpload) {
      const { error: erroreRiga } = await supabase.from('documenti').insert({
        id: documentoId, studio_id: studioId, matter_id: matterId,
        nome_file: nomeFile, storage_path: storagePath,
      });
      if (!erroreRiga) salvato = { documentoId, nomeFile };
    }

    const dopo = await creditoStudio(studioId, contesto.plan);
    return NextResponse.json({ ok: true, testo, note, salvato, credito: creditoPubblico(dopo) });
  } catch (errore) {
    return NextResponse.json({ error: messaggioErroreAi(errore) }, { status: 502 });
  }
}

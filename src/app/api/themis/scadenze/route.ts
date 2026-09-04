import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { getClaude, aiConfigurata, MODELLO, conRitentativi, messaggioErroreAi } from '@/lib/ai/claude';
import { creditoStudio, registraUtilizzo, creditoPubblico } from '@/lib/ai/credito';
import { apriMessaggioPec } from '@/lib/pec/parse';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Quante PEC si esaminano per ogni giro. */
const PER_GIRO = 5;

const ISTRUZIONI = `Ti chiami Themis. Leggi una comunicazione PEC ricevuta da uno studio legale italiano e individui le scadenze che ne derivano.

Rispondi SOLO con un array JSON, senza testo prima o dopo. Ogni elemento:
{"tipo":"udienza"|"ctu"|"termine"|"scadenza"|"appuntamento"|"altro","data":"AAAA-MM-GG","ora":"HH:MM"|null,"titolo":"...","estratto":"...","confidenza":"alta"|"bassa"}

IL TIPO — sceglilo con precisione, perché in un'agenda legale sono cose diverse:
- "udienza": comparizione davanti a un giudice. Solo quella.
- "ctu": visita medico-legale, operazioni peritali, inizio operazioni del consulente.
- "termine": termine processuale da rispettare (deposito, costituzione, osservazioni alla CTU).
- "scadenza": termine non processuale (riscontro a una compagnia, adempimento amministrativo).
- "appuntamento": incontro di mediazione, negoziazione assistita, convocazione.
- "altro": quando nessuno dei precedenti descrive davvero il fatto.

REGOLE:
- "data" è la data del termine o dell'udienza, non quella del messaggio.
- Se il messaggio indica un termine relativo ("entro 30 giorni dal ricevimento"), calcolalo a partire dalla DATA DEL MESSAGGIO che ti viene fornita, e scrivi nel titolo il conteggio che hai fatto. NON applicare la sospensione feriale: dipende dalla materia e la calcola il difensore.
- "estratto" è la frase ESATTA del messaggio da cui ricavi la scadenza, copiata alla lettera. Serve al difensore per controllarti: senza, la proposta non vale niente. Se non riesci a citare una frase precisa, non proporre quella scadenza.
- "confidenza": "alta" solo quando la data è scritta esplicitamente nel testo. Un termine che hai dovuto calcolare, o dedotto dal contesto, è sempre "bassa".
- "titolo" breve e concreto: cosa scade, non una descrizione generica.
- Le semplici ricevute di accettazione e consegna non contengono scadenze: per quelle rispondi [].
- Nel dubbio NON proporre. Una scadenza inventata finisce in un calendario e ci resta; una mancata la si scopre leggendo la PEC, che il difensore fa comunque.
- Se non trovi nulla, rispondi esattamente: []`;

type Estratta = {
  tipo: string; data: string; ora: string | null;
  titolo: string; estratto: string; confidenza: string;
};

export async function POST(request: Request) {
  if (!aiConfigurata()) {
    return NextResponse.json({ error: 'Themis non è ancora attivo su questo sito.' }, { status: 503 });
  }
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const credito = await creditoStudio(contesto.studioId, contesto.plan);
  if (credito.esaurito) {
    return NextResponse.json({
      error: credito.totaleMillesimi === 0
        ? 'Themis non è momentaneamente disponibile. Riprova più tardi.'
        : 'Hai esaurito il credito mensile di Themis. Riparte il primo del mese prossimo.',
    }, { status: 402 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Si esaminano solo le PEC vere già archiviate: le ricevute di
  // accettazione e consegna non contengono scadenze, e senza l'originale
  // non c'è testo da leggere.
  const { data: giaViste } = await admin
    .from('pec_proposte').select('pec_messaggio_id').eq('studio_id', contesto.studioId);
  const esaminati = new Set((giaViste ?? []).map((r) => r.pec_messaggio_id));

  const { data: candidati } = await supabase
    .from('pec_messaggi')
    .select('id, oggetto, mittente, data_invio, matter_id, storage_path_eml, studio_id, tipo_pec, archiviato')
    .eq('tipo_pec', 'posta-certificata')
    .eq('archiviato', true)
    .order('data_invio', { ascending: false })
    .limit(60);

  const daLeggere = (candidati ?? []).filter((m) => !esaminati.has(m.id)).slice(0, PER_GIRO);
  if (daLeggere.length === 0) {
    return NextResponse.json({ ok: true, esaminati: 0, proposte: 0, restanti: 0 });
  }

  // Le proposte che l'avvocato ha scartato in passato — non le righe
  // "Nessuna scadenza rilevata" che questa stessa route inserisce da sola
  // per non rianalizzare una PEC senza scadenze (quelle hanno estratto
  // nullo, un vero scarto dell'avvocato ha sempre la frase da cui viene).
  const { data: rifiutate } = await admin
    .from('pec_proposte')
    .select('titolo_proposto, estratto')
    .eq('studio_id', contesto.studioId).eq('stato', 'rifiutata').not('estratto', 'is', null)
    .order('created_at', { ascending: false }).limit(5);
  const bloccoRifiutate = (rifiutate ?? []).length
    ? `\n\nPROPOSTE SCARTATE DALL'AVVOCATO IN PASSATO (non erano vere scadenze — sii più cauto con frasi simili):\n`
      + rifiutate!.map((r, i) => `${i + 1}. "${r.titolo_proposto}" — dal testo: «${r.estratto}»`).join('\n')
    : '';

  let create = 0;
  let falliti = 0;
  try {
    const claude = getClaude();

    for (const messaggio of daLeggere) {
      try {
      const { data: file } = await admin.storage
        .from(DOCUMENTS_BUCKET).download(messaggio.storage_path_eml as string);
      if (!file) continue;

      const sorgente = decryptBuffer(Buffer.from(await file.arrayBuffer()), messaggio.studio_id);
      const aperto = await apriMessaggioPec(sorgente);
      const corpo = (aperto.corpoTesto ?? '').slice(0, 20000);
      if (!corpo.trim()) continue;

      const dataMessaggio = messaggio.data_invio
        ? new Date(messaggio.data_invio).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const risposta = await conRitentativi(() => claude.messages.create({
        model: MODELLO,
        max_tokens: 1500,
        system: ISTRUZIONI,
        messages: [{
          role: 'user',
          content: `DATA DEL MESSAGGIO: ${dataMessaggio}\nMITTENTE: ${messaggio.mittente ?? '?'}\n`
            + `OGGETTO: ${messaggio.oggetto ?? '?'}\n\nTESTO:\n${corpo}`
            + bloccoRifiutate,
        }],
      }));

      await registraUtilizzo(contesto.studioId, 'scadenze', risposta.usage);

      const testo = risposta.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text).join('').trim();

      let estratte: Estratta[] = [];
      try {
        // Il modello a volte incornicia il JSON: si prende dalla prima
        // parentesi quadra all'ultima invece di fallire sull'involucro.
        const da = testo.indexOf('[');
        const a = testo.lastIndexOf(']');
        if (da !== -1 && a > da) estratte = JSON.parse(testo.slice(da, a + 1));
      } catch {
        // Risposta non interpretabile: si salta questo messaggio e si
        // prosegue. Verrà riesaminato al prossimo giro.
        continue;
      }

      for (const e of estratte) {
        // Solo i valori che la tabella accetta con certezza, e solo
        // proposte ancorate a una frase del messaggio.
        const TIPI = ['udienza', 'ctu', 'termine', 'scadenza', 'appuntamento', 'altro'];
        if (!TIPI.includes(e.tipo)) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) continue;
        if (!e.estratto?.trim() || !e.titolo?.trim()) continue;

        const { error } = await admin.from('pec_proposte').insert({
          studio_id: contesto.studioId,
          pec_messaggio_id: messaggio.id,
          matter_id: messaggio.matter_id,
          tipo_proposto: e.tipo,
          data_proposta: e.data,
          ora_proposta: /^\d{2}:\d{2}$/.test(e.ora ?? '') ? e.ora : null,
          titolo_proposto: e.titolo.slice(0, 200),
          estratto: e.estratto.slice(0, 1000),
          confidenza: e.confidenza === 'alta' ? 'alta' : 'bassa',
        });
        if (!error) create += 1;
      }

      // Se il messaggio non produce proposte, si segna comunque come
      // esaminato con una riga scartata: altrimenti al giro dopo si
      // ripaga la stessa lettura, all'infinito.
      if (estratte.length === 0) {
        await admin.from('pec_proposte').insert({
          studio_id: contesto.studioId,
          pec_messaggio_id: messaggio.id,
          matter_id: messaggio.matter_id,
          tipo_proposto: 'scadenza',
          data_proposta: dataMessaggio,
          titolo_proposto: 'Nessuna scadenza rilevata',
          estratto: null,
          confidenza: 'bassa',
          stato: 'rifiutata',
        });
      }
      } catch (erroreMessaggio) {
        // Una PEC che non si riesce ad analizzare non deve far perdere le
        // altre quattro del giro. Non si registra nulla, così al prossimo
        // tentativo viene riesaminata.
        falliti += 1;
        console.error('Analisi PEC non riuscita', messaggio.id, '—',
          erroreMessaggio instanceof Error ? erroreMessaggio.message : erroreMessaggio);
      }
    }

    const restanti = Math.max(0, (candidati ?? []).filter((m) => !esaminati.has(m.id)).length - daLeggere.length);
    const dopo = await creditoStudio(contesto.studioId, contesto.plan);
    return NextResponse.json({
      ok: true, esaminati: daLeggere.length - falliti, proposte: create, restanti, falliti,
      credito: creditoPubblico(dopo),
    });
  } catch (errore) {
    return NextResponse.json({ error: messaggioErroreAi(errore) }, { status: 502 });
  }
}

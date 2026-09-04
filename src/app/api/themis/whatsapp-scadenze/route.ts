import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { getClaude, aiConfigurata, MODELLO, conRitentativi, messaggioErroreAi } from '@/lib/ai/claude';
import { creditoStudio, registraUtilizzo, creditoPubblico } from '@/lib/ai/credito';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Gemella di /api/themis/scadenze, ma per WhatsApp — non la stessa
 * funzione parametrizzata: una PEC è una lettera, un messaggio WhatsApp è
 * spesso un frammento di una conversazione fatta di più messaggi brevi
 * ("ci vediamo domani?" / "alle 15?" / "va bene"), e leggerlo da solo,
 * senza gli ultimi scambi, perderebbe il senso. Il file resta separato
 * anche per non toccare una route PEC già in produzione per un'esigenza
 * che in realtà differisce nella lettura, non solo nella tabella.
 */
const PER_GIRO = 10;

const ISTRUZIONI = `Ti chiami Themis. Leggi un messaggio WhatsApp ricevuto da un cliente di uno studio legale italiano, insieme ai messaggi più recenti della stessa conversazione per contesto, e individui le scadenze che ne derivano.

Rispondi SOLO con un array JSON, senza testo prima o dopo. Ogni elemento:
{"tipo":"udienza"|"ctu"|"termine"|"scadenza"|"appuntamento"|"altro","data":"AAAA-MM-GG","ora":"HH:MM"|null,"titolo":"...","estratto":"...","confidenza":"alta"|"bassa"}

IL TIPO:
- "udienza": comparizione davanti a un giudice.
- "ctu": visita medico-legale, operazioni peritali.
- "termine": termine processuale.
- "scadenza": termine non processuale.
- "appuntamento": un incontro, anche informale (venire in studio, incontrare il cliente).
- "altro": quando nessuno dei precedenti descrive il fatto.

REGOLE:
- Analizza SOLO l'ULTIMO messaggio (quello marcato "MESSAGGIO DA ANALIZZARE"): i precedenti servono solo a capirlo, non generano proposte proprie — altrimenti lo stesso appuntamento verrebbe riproposto ogni volta che arriva un messaggio nella stessa conversazione.
- Un cliente scrive in modo informale e spesso senza l'anno: se manca, deduci l'anno più vicino nel futuro rispetto alla data del messaggio.
- "estratto" è la frase ESATTA del messaggio da analizzare da cui ricavi la scadenza, copiata alla lettera.
- "confidenza": "alta" solo quando la data è scritta esplicitamente. Una dedotta da "domani" o "martedì prossimo" è comunque "alta" se il calcolo è certo; una vaga ("prossimamente", "appena posso") è "bassa".
- Chiacchiere, saluti, ringraziamenti, domande generiche senza una data non contengono scadenze: per quelle rispondi [].
- Nel dubbio NON proporre.
- Se non trovi nulla, rispondi esattamente: []`;

type Estratta = {
  tipo: string; data: string; ora: string | null;
  titolo: string; estratto: string; confidenza: string;
};

export async function POST() {
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

  const admin = createAdminClient();

  const { data: candidati } = await admin
    .from('whatsapp_messaggi')
    .select('id, jid_mittente, matter_id, testo_cifrato, ricevuto_il')
    .eq('studio_id', contesto.studioId)
    .eq('direzione', 'in')
    .eq('analizzato', false)
    .order('ricevuto_il', { ascending: true })
    .limit(PER_GIRO);

  if (!candidati || candidati.length === 0) {
    return NextResponse.json({ ok: true, esaminati: 0, proposte: 0, restanti: 0 });
  }

  const studioId = contesto.studioId;
  const decifra = (blob: string): string => {
    try {
      return decryptBuffer(Buffer.from(blob, 'base64'), studioId).toString('utf-8');
    } catch {
      return '';
    }
  };

  // Le proposte che l'avvocato ha scartato in passato: non sono un fatto
  // da riproporre in altre parole, sono un esempio di "questo non è una
  // vera scadenza" per questo studio. Un giro solo, non per ogni
  // messaggio: cinque esempi bastano a orientare senza appesantire ogni
  // singola richiesta.
  const { data: rifiutate } = await admin
    .from('whatsapp_proposte')
    .select('titolo_proposto, estratto')
    .eq('studio_id', studioId).eq('stato', 'rifiutata')
    .order('creata_il', { ascending: false }).limit(5);
  const bloccoRifiutate = (rifiutate ?? []).length
    ? `\n\nPROPOSTE SCARTATE DALL'AVVOCATO IN PASSATO (non erano vere scadenze — sii più cauto con frasi simili):\n`
      + rifiutate!.map((r, i) => `${i + 1}. "${r.titolo_proposto}" — dal testo: «${r.estratto ?? ''}»`).join('\n')
    : '';

  let create = 0;
  let falliti = 0;
  try {
    const claude = getClaude();

    for (const messaggio of candidati) {
      try {
        const testoDaAnalizzare = decifra(messaggio.testo_cifrato);
        if (!testoDaAnalizzare.trim()) {
          await admin.from('whatsapp_messaggi').update({ analizzato: true }).eq('id', messaggio.id);
          continue;
        }

        // Gli ultimi scambi della stessa conversazione, solo come contesto.
        const { data: precedenti } = await admin
          .from('whatsapp_messaggi')
          .select('testo_cifrato, direzione, ricevuto_il')
          .eq('studio_id', contesto.studioId)
          .eq('jid_mittente', messaggio.jid_mittente)
          .lt('ricevuto_il', messaggio.ricevuto_il)
          .order('ricevuto_il', { ascending: false })
          .limit(6);
        const contestoConversazione = (precedenti ?? [])
          .reverse()
          .map((m) => `${m.direzione === 'in' ? 'CLIENTE' : 'STUDIO'}: ${decifra(m.testo_cifrato)}`)
          .filter((r) => r.trim() !== 'CLIENTE:' && r.trim() !== 'STUDIO:')
          .join('\n');

        const dataMessaggio = new Date(messaggio.ricevuto_il).toISOString().slice(0, 10);

        const risposta = await conRitentativi(() => claude.messages.create({
          model: MODELLO,
          max_tokens: 1000,
          system: ISTRUZIONI,
          messages: [{
            role: 'user',
            content: `DATA DEL MESSAGGIO DA ANALIZZARE: ${dataMessaggio}\n\n`
              + (contestoConversazione ? `CONVERSAZIONE PRECEDENTE (solo contesto):\n${contestoConversazione}\n\n` : '')
              + `MESSAGGIO DA ANALIZZARE:\nCLIENTE: ${testoDaAnalizzare}`
              + bloccoRifiutate,
          }],
        }));

        await registraUtilizzo(contesto.studioId, 'whatsapp-scadenze', risposta.usage);

        const testo = risposta.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text).join('').trim();

        let estratte: Estratta[] = [];
        try {
          const da = testo.indexOf('[');
          const a = testo.lastIndexOf(']');
          if (da !== -1 && a > da) estratte = JSON.parse(testo.slice(da, a + 1));
        } catch {
          // Risposta non interpretabile: si marca comunque come esaminato
          // (si è comunque pagata la richiesta) e si prosegue col prossimo.
        }

        const TIPI = ['udienza', 'ctu', 'termine', 'scadenza', 'appuntamento', 'altro'];
        for (const e of estratte) {
          if (!TIPI.includes(e.tipo)) continue;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) continue;
          if (!e.estratto?.trim() || !e.titolo?.trim()) continue;

          const { error } = await admin.from('whatsapp_proposte').insert({
            studio_id: contesto.studioId,
            messaggio_id: messaggio.id,
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

        await admin.from('whatsapp_messaggi').update({ analizzato: true }).eq('id', messaggio.id);
      } catch (erroreMessaggio) {
        falliti += 1;
        console.error('Analisi messaggio WhatsApp non riuscita', messaggio.id, '—',
          erroreMessaggio instanceof Error ? erroreMessaggio.message : erroreMessaggio);
      }
    }

    const { count: restanti } = await admin
      .from('whatsapp_messaggi').select('id', { count: 'exact', head: true })
      .eq('studio_id', contesto.studioId).eq('direzione', 'in').eq('analizzato', false);

    const dopo = await creditoStudio(contesto.studioId, contesto.plan);
    return NextResponse.json({
      ok: true, esaminati: candidati.length - falliti, proposte: create,
      restanti: restanti ?? 0, falliti, credito: creditoPubblico(dopo),
    });
  } catch (errore) {
    return NextResponse.json({ error: messaggioErroreAi(errore) }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { getClaude, aiConfigurata, MODELLO, conRitentativi, messaggioErroreAi } from '@/lib/ai/claude';
import { creditoStudio, registraUtilizzo, creditoPubblico } from '@/lib/ai/credito';
import { clientLabel } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ISTRUZIONI = `Ti chiami Themis. Un cliente ha mandato un documento su WhatsApp da un numero che lo studio non ha ancora in anagrafica. Devi solo SUGGERIRE chi potrebbe essere — la decisione resta sempre dell'avvocato, tu non colleghi nulla.

Ti arrivano: il testo o la didascalia del messaggio (se c'è), il nome del file allegato (spesso contiene già un cognome, es. "CALDARELLA - precetto.pdf"), e l'elenco dei clienti già in anagrafica con il loro id.

Rispondi SOLO con un oggetto JSON, senza testo prima o dopo, in una di queste tre forme:

Se un nome nel testo o nel file corrisponde chiaramente a UNO dei clienti in elenco:
{"tipo":"esistente","clienteId":"...","motivo":"..."}

Se il testo o il file indicano chiaramente il nome di una persona che NON è nell'elenco (quindi probabilmente un cliente nuovo):
{"tipo":"nuovo","tipoSoggetto":"persona_fisica"|"persona_giuridica","nome":"...","cognome":"...","ragioneSociale":"...","motivo":"..."}

Se non c'è abbastanza per dirlo con ragionevole certezza:
{"tipo":"incerto","motivo":"..."}

REGOLE:
- Non indovinare un cliente esistente solo perché il cognome è comune o parzialmente simile: nel dubbio rispondi "incerto". Un documento allegato al fascicolo sbagliato è un problema serio, molto peggio di chiedere all'avvocato.
- Non inventare mai un nome per "nuovo" che non compaia davvero nel testo o nel nome del file.
- "motivo" è una frase brevissima che spiega da cosa lo capisci (es. "il cognome nel nome del file corrisponde"), serve all'avvocato per controllarti.`;

type Suggerimento =
  | { tipo: 'esistente'; clienteId: string; motivo: string }
  | { tipo: 'nuovo'; tipoSoggetto: string; nome: string; cognome: string; ragioneSociale: string; motivo: string }
  | { tipo: 'incerto'; motivo: string };

export async function POST(request: Request) {
  if (!aiConfigurata()) {
    return NextResponse.json({ error: 'Themis non è ancora attivo su questo sito.' }, { status: 503 });
  }
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { messaggioId } = await request.json();
  if (typeof messaggioId !== 'string') {
    return NextResponse.json({ error: 'Manca il messaggio da esaminare' }, { status: 400 });
  }

  const credito = await creditoStudio(contesto.studioId, contesto.plan);
  if (credito.esaurito) {
    return NextResponse.json({
      error: credito.totaleMillesimi === 0
        ? 'Themis non è momentaneamente disponibile. Riprova più tardi.'
        : 'Hai esaurito il credito mensile di Themis. Riparte il primo del mese prossimo.',
    }, { status: 402 });
  }

  const admin = createAdminClient();
  const [{ data: messaggio }, { data: clientiRighe }] = await Promise.all([
    admin.from('whatsapp_messaggi')
      .select('id, testo_cifrato, documento_nome, stato_match')
      .eq('id', messaggioId).eq('studio_id', contesto.studioId).maybeSingle(),
    admin.from('clients')
      .select('id, nome, cognome, ragione_sociale, tipo_soggetto')
      .eq('studio_id', contesto.studioId).eq('archiviato', false),
  ]);
  if (!messaggio) return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
  if (messaggio.stato_match === 'abbinato') {
    return NextResponse.json({ ok: true, suggerimento: { tipo: 'incerto', motivo: 'già collegato' } });
  }

  let testo = '';
  try {
    testo = decryptBuffer(Buffer.from(messaggio.testo_cifrato, 'base64'), contesto.studioId).toString('utf-8');
  } catch { /* resta vuoto, si prosegue solo col nome del file */ }

  const elencoClienti = (clientiRighe ?? [])
    .map((c) => `${c.id} — ${clientLabel(c)}`).join('\n') || '(nessun cliente in anagrafica)';

  try {
    const claude = getClaude();
    const risposta = await conRitentativi(() => claude.messages.create({
      model: MODELLO,
      max_tokens: 400,
      system: ISTRUZIONI,
      messages: [{
        role: 'user',
        content: `TESTO O DIDASCALIA DEL MESSAGGIO:\n${testo || '(nessuno)'}\n\n`
          + `NOME DEL FILE ALLEGATO:\n${messaggio.documento_nome || '(nessuno)'}\n\n`
          + `CLIENTI GIÀ IN ANAGRAFICA:\n${elencoClienti}`,
      }],
    }));

    await registraUtilizzo(contesto.studioId, 'whatsapp-abbina', risposta.usage);

    const grezzo = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('').trim();

    let suggerimento: Suggerimento = { tipo: 'incerto', motivo: 'risposta non interpretabile' };
    try {
      const da = grezzo.indexOf('{');
      const a = grezzo.lastIndexOf('}');
      if (da !== -1 && a > da) {
        const parsed = JSON.parse(grezzo.slice(da, a + 1));
        // Un clienteId suggerito deve esistere davvero fra quelli passati:
        // altrimenti si tratta come "incerto" invece di proporre un id a caso.
        if (parsed.tipo === 'esistente' && (clientiRighe ?? []).some((c) => c.id === parsed.clienteId)) {
          suggerimento = { tipo: 'esistente', clienteId: parsed.clienteId, motivo: String(parsed.motivo ?? '') };
        } else if (parsed.tipo === 'nuovo' && (parsed.nome || parsed.cognome || parsed.ragioneSociale)) {
          suggerimento = {
            tipo: 'nuovo',
            tipoSoggetto: parsed.tipoSoggetto === 'persona_giuridica' ? 'persona_giuridica' : 'persona_fisica',
            nome: String(parsed.nome ?? ''), cognome: String(parsed.cognome ?? ''),
            ragioneSociale: String(parsed.ragioneSociale ?? ''), motivo: String(parsed.motivo ?? ''),
          };
        } else {
          suggerimento = { tipo: 'incerto', motivo: String(parsed.motivo ?? '') };
        }
      }
    } catch { /* resta "incerto" */ }

    const dopo = await creditoStudio(contesto.studioId, contesto.plan);
    return NextResponse.json({ ok: true, suggerimento, credito: creditoPubblico(dopo) });
  } catch (errore) {
    return NextResponse.json({ error: messaggioErroreAi(errore) }, { status: 502 });
  }
}

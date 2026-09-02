import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { getClaude, aiConfigurata, MODELLO, conRitentativi, messaggioErroreAi } from '@/lib/ai/claude';
import { creditoStudio, registraUtilizzo, creditoPubblico } from '@/lib/ai/credito';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ISTRUZIONI = `Ti chiami Themis e scrivi la bozza di una risposta WhatsApp di uno studio legale italiano a un proprio cliente.

Un messaggio WhatsApp non è una PEC: è breve, diretto, senza formule di cortesia lunghe — ma resta la risposta di un avvocato al proprio assistito, non una chat fra amici.

REGOLE SUI FATTI:
- Nomi, date, numeri di pratica e di sinistro si prendono ALLA LETTERA dai dati che ricevi, mai ricostruiti.
- Se un dato non risulta da nessuna parte, usa il segnaposto [DA COMPLETARE: che cosa manca] invece di inventarlo.
- Non dare per avvenuti fatti che non risultano dai dati o dalla conversazione.

REGOLE SUL DIRITTO:
- NON citare MAI sentenze, massime o articoli di legge in un messaggio WhatsApp: qui non è la sede, e un cliente non distinguerebbe una citazione corretta da una inventata. Se serve un riferimento normativo, rimanda a una comunicazione più formale: "te lo spiego meglio via PEC/in studio".

REGISTRO:
- Diretto, cortese, senza formalismi da lettera. Frasi brevi.
- Nessuna firma, nessun saluto di chiusura elaborato: è una chat, non una PEC.
- Se manca un'informazione per rispondere con certezza, dillo chiaramente invece di essere vago.

Rispondi SOLO con il testo del messaggio da inviare, senza introduzioni né commenti.`;

export async function POST(request: Request) {
  if (!aiConfigurata()) {
    return NextResponse.json({ error: 'Themis non è ancora attivo su questo sito.' }, { status: 503 });
  }
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { messaggioId } = await request.json();
  if (typeof messaggioId !== 'string') {
    return NextResponse.json({ error: 'Manca il messaggio a cui rispondere' }, { status: 400 });
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
  const { data: messaggio } = await admin
    .from('whatsapp_messaggi')
    .select('id, jid_mittente, matter_id, cliente_id, ricevuto_il')
    .eq('id', messaggioId).eq('studio_id', contesto.studioId).maybeSingle();
  if (!messaggio) return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });

  const studioId = contesto.studioId;
  const decifra = (blob: string): string => {
    try {
      return decryptBuffer(Buffer.from(blob, 'base64'), studioId).toString('utf-8');
    } catch {
      return '(non leggibile)';
    }
  };

  const { data: conversazione } = await admin
    .from('whatsapp_messaggi')
    .select('testo_cifrato, direzione, ricevuto_il')
    .eq('studio_id', contesto.studioId)
    .eq('jid_mittente', messaggio.jid_mittente)
    .order('ricevuto_il', { ascending: false })
    .limit(10);
  const storico = (conversazione ?? [])
    .reverse()
    .map((m) => `${m.direzione === 'in' ? 'CLIENTE' : 'STUDIO'}: ${decifra(m.testo_cifrato)}`)
    .join('\n');

  let scheda = 'Nessuna pratica collegata a questo numero.';
  if (messaggio.matter_id) {
    const { data: pratica } = await admin
      .from('matters')
      .select('*, clients(nome, cognome, ragione_sociale)')
      .eq('id', messaggio.matter_id).maybeSingle();
    if (pratica) {
      const cliente = Array.isArray(pratica.clients) ? pratica.clients[0] : pratica.clients;
      scheda = [
        `Tipo di pratica: ${pratica.tipo_pratica}`,
        cliente && `Assistito: ${[cliente.cognome, cliente.nome].filter(Boolean).join(' ') || cliente.ragione_sociale}`,
        pratica.controparte_nome && `Controparte: ${pratica.controparte_nome}`,
        pratica.compagnia_assicurativa && `Compagnia: ${pratica.compagnia_assicurativa}`,
        pratica.tribunale && `Tribunale: ${pratica.tribunale}`,
        pratica.rg_numero && `R.G. ${pratica.rg_numero}/${pratica.rg_anno ?? ''}`,
      ].filter(Boolean).join('\n');
    }
  }

  try {
    const claude = getClaude();
    const risposta = await conRitentativi(() => claude.messages.create({
      model: MODELLO,
      max_tokens: 800,
      system: ISTRUZIONI,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `DATI DELLA PRATICA\n${scheda}` },
          { type: 'text', text: `CONVERSAZIONE WHATSAPP (dalla più vecchia alla più recente):\n${storico}` },
          { type: 'text', text: 'Scrivi la risposta al messaggio più recente del cliente.' },
        ],
      }],
    }));

    await registraUtilizzo(contesto.studioId, 'whatsapp-bozza', risposta.usage);

    const testo = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('').trim();

    const dopo = await creditoStudio(contesto.studioId, contesto.plan);
    return NextResponse.json({ ok: true, testo, credito: creditoPubblico(dopo) });
  } catch (errore) {
    return NextResponse.json({ error: messaggioErroreAi(errore) }, { status: 502 });
  }
}

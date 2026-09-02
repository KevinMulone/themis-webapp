import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { whatsappConfigurato, connettiWorker, aggiornaAccountLocale } from '@/lib/whatsapp/worker';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Avvia l'accoppiamento e torna il QR da mostrare. Riservato al
 *  titolare: è lui che collega il numero dello studio. */
export async function POST() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può collegare WhatsApp' }, { status: 403 });
  }
  if (!whatsappConfigurato()) {
    return NextResponse.json({ error: 'WhatsApp non è ancora attivo su questo sito.' }, { status: 503 });
  }

  try {
    const risposta = await connettiWorker(contesto.studioId);
    await aggiornaAccountLocale(contesto.studioId, risposta);
    return NextResponse.json({ ok: true, qr: risposta.qr, stato: risposta.stato });
  } catch (errore) {
    return NextResponse.json(
      { error: errore instanceof Error ? errore.message : 'Servizio WhatsApp non raggiungibile' },
      { status: 502 },
    );
  }
}

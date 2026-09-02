import { NextResponse } from 'next/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { whatsappConfigurato, statoWorker, aggiornaAccountLocale } from '@/lib/whatsapp/worker';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Lo stato vero, letto in diretta dal worker — non dall'ultima riga
 * salvata — perché questa route è quella su cui gira il poll della
 * schermata di accoppiamento: mostrare una cache stantia mentre il QR sta
 * per scadere sarebbe peggio che aspettare qualche centinaio di
 * millisecondi in più.
 */
export async function GET() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (!whatsappConfigurato()) return NextResponse.json({ configurato: false });

  try {
    const risposta = await statoWorker(contesto.studioId);
    await aggiornaAccountLocale(contesto.studioId, risposta);
    return NextResponse.json({ configurato: true, ...risposta });
  } catch {
    // Il worker non risponde: si dichiara "disconnesso" invece di rompere
    // la pagina — mai il silenzio al posto di un errore visibile.
    return NextResponse.json({ configurato: true, stato: 'disconnesso' });
  }
}

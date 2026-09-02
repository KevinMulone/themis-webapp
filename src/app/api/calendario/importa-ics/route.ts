import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';

export const runtime = 'nodejs';

/**
 * Riceve gli impegni già estratti dal file, non il file.
 *
 * La prima versione accettava il .ics caricato e lo leggeva qui: sbagliato
 * per due motivi. Vercel rifiuta qualunque richiesta oltre 4,5 MB — un
 * limite dell'infrastruttura che non si alza dal codice — e l'export di un
 * calendario di anni li supera facilmente; per giunta l'errore tornava come
 * pagina HTML, quindi al posto di un messaggio comprensibile compariva
 * "risposta non leggibile".
 *
 * Ora il file viene letto nel browser e qui arrivano solo gli impegni già
 * filtrati per data, a blocchi. Oltre a togliere il problema della
 * dimensione, il calendario completo — che per un avvocato contiene anche
 * tutta la vita privata — non lascia mai il suo computer: viaggia soltanto
 * ciò che ha scelto di importare.
 */

const MASSIMO_PER_BLOCCO = 500;

type ImpegnoInArrivo = {
  uid?: unknown; titolo?: unknown; data?: unknown;
  ora_inizio?: unknown; ora_fine?: unknown; all_day?: unknown;
  luogo?: unknown; note?: unknown; ricorrente?: unknown;
};

function testoBreve(valore: unknown, massimo: number): string | null {
  return typeof valore === 'string' && valore.trim() ? valore.trim().slice(0, massimo) : null;
}

/** Solo YYYY-MM-DD e HH:MM passano: quello che arriva dal browser è
 *  comunque input di rete, e va trattato come tale. */
function dataValida(valore: unknown): string | null {
  return typeof valore === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valore) ? valore : null;
}
function oraValida(valore: unknown): string | null {
  return typeof valore === 'string' && /^\d{2}:\d{2}$/.test(valore) ? valore : null;
}

export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  let corpo: { impegni?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Richiesta non leggibile' }, { status: 400 });
  }

  const inArrivo = Array.isArray(corpo.impegni) ? (corpo.impegni as ImpegnoInArrivo[]) : null;
  if (!inArrivo || inArrivo.length === 0) {
    return NextResponse.json({ error: 'Nessun impegno da importare' }, { status: 400 });
  }
  if (inArrivo.length > MASSIMO_PER_BLOCCO) {
    return NextResponse.json(
      { error: `Troppi impegni in una sola richiesta (massimo ${MASSIMO_PER_BLOCCO})` },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Chi è già stato importato non rientra: l'identificativo d'origine è la
  // chiave, così l'importazione si può rilanciare senza duplicare nulla.
  const uid = inArrivo.map((i) => testoBreve(i.uid, 300)).filter(Boolean) as string[];
  const { data: presenti } = await supabase
    .from('eventi')
    .select('google_event_id')
    .eq('studio_id', contesto.studioId)
    .in('google_event_id', uid.length ? uid : ['-']);
  const giaDentro = new Set((presenti ?? []).map((r) => r.google_event_id));

  const righe = [];
  // Non basta confrontare con ciò che è già nel database: lo stesso
  // identificativo può comparire due volte dentro la stessa richiesta, e
  // finirebbe inserito due volte. Quelli visti qui si aggiungono man mano.
  for (const i of inArrivo) {
    const data = dataValida(i.data);
    const identificativo = testoBreve(i.uid, 300);
    if (!data || !identificativo || giaDentro.has(identificativo)) continue;
    giaDentro.add(identificativo);

    const note = testoBreve(i.note, 4000);
    const tuttoIlGiorno = i.all_day === true;
    righe.push({
      studio_id: contesto.studioId,
      titolo: testoBreve(i.titolo, 300) ?? '(senza titolo)',
      // Google non distingue un'udienza da un pranzo: entrano tutti come
      // "Attività", e il tipo giusto si mette dopo, sui pochi che contano.
      tipo: 'altro',
      data,
      ora_inizio: tuttoIlGiorno ? null : oraValida(i.ora_inizio),
      ora_fine: tuttoIlGiorno ? null : oraValida(i.ora_fine),
      all_day: tuttoIlGiorno,
      luogo: testoBreve(i.luogo, 500),
      note: i.ricorrente === true
        ? [note, '(impegno ricorrente: importata solo la prima data)'].filter(Boolean).join('\n\n')
        : note,
      google_event_id: identificativo,
    });
  }

  if (righe.length === 0) {
    return NextResponse.json({ ok: true, importati: 0, saltati: inArrivo.length });
  }

  const { error } = await supabase.from('eventi').insert(righe);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    importati: righe.length,
    saltati: inArrivo.length - righe.length,
  });
}

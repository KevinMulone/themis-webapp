import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { leggiIcs, type ImpegnoImportato } from '@/lib/calendario/leggiIcs';

export const runtime = 'nodejs';
/** Un calendario di dieci anni può contenere migliaia di voci: si dà tempo. */
export const maxDuration = 120;

/**
 * Porta dentro Themis il calendario che l'avvocato aveva prima.
 *
 * Non serve OAuth né alcun permesso su Google: la migrazione si fa una
 * volta sola, e per farla basta il file che Google stesso mette a
 * disposizione (Impostazioni → Importa ed esporta → Esporta), che arriva
 * come .zip contenente un .ics per ogni calendario.
 *
 * Due comportamenti scelti apposta:
 * — si può chiedere l'anteprima (nessuna scrittura) prima di confermare,
 *   perché rovesciare anni di impegni personali dentro l'agenda dello
 *   studio senza vederli prima è un errore che non si disfa comodamente;
 * — un impegno già importato non entra due volte, riconosciuto dal suo
 *   identificativo d'origine: si può rilanciare l'importazione senza
 *   duplicare nulla.
 */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const da = (form.get('da') as string) || '';
  const soloAnteprima = form.get('anteprima') === 'sì';
  if (!file) return NextResponse.json({ error: 'Nessun file' }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'Il file supera i 25 MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const nome = file.name.toLowerCase();

  // Google esporta uno .zip con dentro un .ics per calendario; chi esporta
  // un solo calendario ottiene direttamente un .ics.
  let testi: string[] = [];
  try {
    if (nome.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(buffer);
      const dentro = Object.values(zip.files).filter((f) => !f.dir && f.name.toLowerCase().endsWith('.ics'));
      if (dentro.length === 0) {
        return NextResponse.json({ error: 'Nello zip non c’è nessun file .ics' }, { status: 400 });
      }
      testi = await Promise.all(dentro.map((f) => f.async('string')));
    } else {
      testi = [buffer.toString('utf-8')];
    }
  } catch {
    return NextResponse.json({ error: 'Il file non si riesce ad aprire' }, { status: 400 });
  }

  let impegni: ImpegnoImportato[] = [];
  for (const t of testi) {
    if (!t.includes('BEGIN:VCALENDAR')) continue;
    impegni = impegni.concat(leggiIcs(t));
  }
  if (impegni.length === 0) {
    return NextResponse.json({ error: 'Nel file non risultano impegni leggibili' }, { status: 400 });
  }

  const totaleNelFile = impegni.length;
  if (da) impegni = impegni.filter((i) => i.data >= da);

  const supabase = await createClient();

  // Chi c'è già non rientra: l'identificativo d'origine è la chiave.
  const { data: presenti } = await supabase
    .from('eventi')
    .select('google_event_id')
    .eq('studio_id', contesto.studioId)
    .not('google_event_id', 'is', null);
  const giaDentro = new Set((presenti ?? []).map((r) => r.google_event_id));

  const nuovi = impegni.filter((i) => !giaDentro.has(i.uid));
  const ricorrenti = nuovi.filter((i) => i.ricorrente).length;

  if (soloAnteprima) {
    const date = nuovi.map((i) => i.data).sort();
    return NextResponse.json({
      anteprima: true,
      totaleNelFile,
      daImportare: nuovi.length,
      giaPresenti: impegni.length - nuovi.length,
      ricorrenti,
      primaData: date[0] ?? null,
      ultimaData: date[date.length - 1] ?? null,
      esempi: nuovi.slice(0, 5).map((i) => ({ titolo: i.titolo, data: i.data, ora: i.ora_inizio })),
    });
  }

  const righe = nuovi.map((i) => ({
    studio_id: contesto.studioId,
    titolo: i.titolo,
    // Google non distingue un'udienza da un pranzo: entrano tutti come
    // "Attività", e il tipo giusto si mette dopo, sui pochi che contano.
    tipo: 'altro',
    data: i.data,
    ora_inizio: i.ora_inizio,
    ora_fine: i.ora_fine,
    all_day: i.all_day,
    luogo: i.luogo,
    note: i.ricorrente
      ? [i.note, '(impegno ricorrente: importata solo la prima data)'].filter(Boolean).join('\n\n')
      : i.note,
    google_event_id: i.uid,
  }));

  // A blocchi: un singolo insert da migliaia di righe va in timeout.
  let inseriti = 0;
  for (let i = 0; i < righe.length; i += 500) {
    const blocco = righe.slice(i, i + 500);
    const { error } = await supabase.from('eventi').insert(blocco);
    if (error) {
      return NextResponse.json(
        { error: `Importazione interrotta dopo ${inseriti} impegni: ${error.message}` },
        { status: 400 },
      );
    }
    inseriti += blocco.length;
  }

  return NextResponse.json({
    ok: true,
    importati: inseriti,
    giaPresenti: impegni.length - nuovi.length,
    ricorrenti,
    totaleNelFile,
  });
}

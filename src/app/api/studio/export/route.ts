import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';

export const runtime = 'nodejs';

const TABELLE = [
  'clients', 'matters', 'matter_parti', 'verifiche_cliente', 'sinistri', 'testimoni',
  'eventi', 'incarichi', 'incarichi_storico', 'documenti', 'document_requests',
  'patrocini_spese_stato', 'calcoli_pratica', 'themis_conversazioni', 'themis_messaggi',
] as const;

export async function GET() {
  const ctx = await contestoStudio();
  if (!ctx) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (ctx.ruolo !== 'titolare') return NextResponse.json({ error: 'Solo il titolare può esportare lo studio' }, { status: 403 });
  const supabase = await createClient();
  const zip = new JSZip();
  const manifest: { creatoIl: string; studioId: string; tabelle: Record<string, number>; avvisi: string[] } = {
    creatoIl: new Date().toISOString(), studioId: ctx.studioId, tabelle: {}, avvisi: [],
  };

  for (const tabella of TABELLE) {
    const { data, error } = await supabase.from(tabella).select('*').eq('studio_id', ctx.studioId).limit(50_000);
    if (error) {
      manifest.avvisi.push(`${tabella}: ${error.message}`);
      continue;
    }
    manifest.tabelle[tabella] = data?.length ?? 0;
    zip.file(`${tabella}.json`, JSON.stringify(data ?? [], null, 2));
  }
  manifest.avvisi.push('I file binari cifrati e le credenziali PEC/Google non sono inclusi in questo export dati.');
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const contenuto = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const corpo = new ArrayBuffer(contenuto.byteLength);
  new Uint8Array(corpo).set(contenuto);
  const data = new Date().toISOString().slice(0, 10);
  return new NextResponse(corpo, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="themis-backup-${data}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}

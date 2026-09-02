import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';

/**
 * Un nome di file pulito per la busta PCT: niente spazi, accenti o
 * caratteri che i gestori di posta e i sistemi di cancelleria trattano in
 * modo imprevedibile. Non tocca l'estensione, che deve restare intatta.
 */
function nomePulito(base: string): string {
  return base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accenti via
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function estensione(nomeFile: string): string {
  const punto = nomeFile.lastIndexOf('.');
  return punto === -1 ? '' : nomeFile.slice(punto);
}

export async function POST(request: Request, ctx: RouteContext<'/api/pratiche/[id]/pacchetto-deposito'>) {
  const { id: matterId } = await ctx.params;
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { attoId, allegatiIds } = (await request.json()) as {
    attoId: string | null; allegatiIds: string[];
  };
  if (!attoId && (!allegatiIds || allegatiIds.length === 0)) {
    return NextResponse.json({ error: 'Scegli almeno un documento' }, { status: 400 });
  }

  const supabase = await createClient();
  // Stesso principio di fiducia già usato altrove: la select con il client
  // normale (non admin) trova la pratica solo se le policy la concedono a
  // chi sta chiamando — è già la verifica di appartenenza allo studio.
  const { data: matter } = await supabase
    .from('matters').select('id, studio_id, tipo_pratica').eq('id', matterId).single();
  if (!matter) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 });

  const idsRichiesti = [attoId, ...(allegatiIds || [])].filter(Boolean) as string[];
  const { data: documenti } = await supabase
    .from('documenti')
    .select('id, nome_file, storage_path, studio_id, matter_id')
    .in('id', idsRichiesti);
  const trovati = documenti || [];
  if (trovati.some((d) => d.matter_id !== matterId)) {
    return NextResponse.json({ error: 'Documento non appartenente a questa pratica' }, { status: 400 });
  }
  if (trovati.length !== idsRichiesti.length) {
    return NextResponse.json({ error: 'Uno o più documenti non sono stati trovati' }, { status: 404 });
  }

  const admin = createAdminClient();
  const zip = new JSZip();

  async function aggiungiAlloZip(documentoId: string, nomeNelloZip: string) {
    const doc = trovati.find((d) => d.id === documentoId)!;
    const { data: fileData, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
    if (error || !fileData) throw new Error(`File non trovato per "${doc.nome_file}"`);
    const cifrato = Buffer.from(await fileData.arrayBuffer());
    // Si decifra con lo scope della riga (il suo studio_id), non con quello
    // di chi sta scaricando: è la regola già stabilita per ogni altro
    // scaricamento di documenti in Themis.
    const chiaro = decryptBuffer(cifrato, doc.studio_id);
    zip.file(nomeNelloZip, chiaro);
  }

  try {
    if (attoId) {
      const doc = trovati.find((d) => d.id === attoId)!;
      await aggiungiAlloZip(attoId, `01_Atto_principale${estensione(doc.nome_file)}`);
    }
    let indice = 1;
    for (const allegatoId of allegatiIds || []) {
      const doc = trovati.find((d) => d.id === allegatoId)!;
      await aggiungiAlloZip(allegatoId, `${String(indice + 1).padStart(2, '0')}_Allegato_${indice}${estensione(doc.nome_file)}`);
      indice += 1;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore nella preparazione' }, { status: 500 });
  }

  const contenuto = await zip.generateAsync({ type: 'nodebuffer' });
  const nomeZip = nomePulito(`deposito_pratica_${matterId.slice(0, 8)}`) + '.zip';

  return new NextResponse(new Uint8Array(contenuto), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomeZip}"`,
    },
  });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { createHash } from 'node:crypto';

export async function POST(request: Request) {
  const supabase = await createClient();
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { studioId } = contesto;

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const matterId = form.get('matter_id') as string | null;
  if (!file || !matterId) return NextResponse.json({ error: 'File e pratica sono obbligatori' }, { status: 400 });

  const { data: matter } = await supabase.from('matters').select('id').eq('id', matterId).single();
  if (!matter) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const hashSha256 = createHash('sha256').update(buffer).digest('hex');
  const documentoId = crypto.randomUUID();
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const storagePath = `documenti/${studioId}/${documentoId}${ext}.enc`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(
    storagePath, encryptBuffer(buffer, studioId), { contentType: 'application/octet-stream', upsert: true },
  );
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const recordBase = {
    id: documentoId, studio_id: studioId, matter_id: matterId, nome_file: file.name, storage_path: storagePath,
  };
  // La versione la calcola un trigger lato database (migrazione 038): sempre
  // corretta per nome file e atomica anche con upload concorrenti, cosa che
  // un conteggio fatto qui prima dell'insert non poteva garantire.
  let { error: dbError } = await supabase.from('documenti').insert({
    ...recordBase, hash_sha256: hashSha256, dimensione_bytes: file.size, caricato_da: contesto.userId,
  });
  // Il deploy può precedere di pochi minuti la migrazione 037: in quel
  // caso il caricamento continua a funzionare con lo schema precedente.
  if (dbError?.code === 'PGRST204' || dbError?.code === '42703') {
    ({ error: dbError } = await supabase.from('documenti').insert(recordBase));
  }
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  return NextResponse.json({ ok: true, documento_id: documentoId });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const requestId = form.get('request_id') as string | null;
  if (!file || !requestId) return NextResponse.json({ error: 'File e richiesta sono obbligatori' }, { status: 400 });

  // Rilettura con il client normale (non admin): se la RLS su
  // document_requests è corretta, il fatto che questa select trovi la riga
  // È GIÀ la prova che chi chiama ha diritto a soddisfare questa richiesta
  // — stesso principio di fiducia usato in api/documenti/upload/route.ts
  // per verificare la proprietà della pratica prima di scrivere.
  const { data: richiesta } = await supabase
    .from('document_requests')
    .select('id, studio_id, matter_id, stato')
    .eq('id', requestId)
    .single();
  if (!richiesta) return NextResponse.json({ error: 'Richiesta non trovata' }, { status: 404 });
  if (richiesta.stato !== 'in_attesa') return NextResponse.json({ error: 'Richiesta già soddisfatta' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentoId = crypto.randomUUID();
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  // Cifrato con lo scope dello STUDIO (mai quello del cliente del portale
  // che sta caricando): è l'unico modo in cui lo studio potrà poi
  // decifrarlo scaricandolo, dato che il download usa sempre il proprio id.
  const storagePath = `documenti/${richiesta.studio_id}/${documentoId}${ext}.enc`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(
    storagePath, encryptBuffer(buffer, richiesta.studio_id), { contentType: 'application/octet-stream', upsert: true },
  );
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error: dbError } = await admin.from('documenti').insert({
    id: documentoId, studio_id: richiesta.studio_id, matter_id: richiesta.matter_id,
    nome_file: file.name, storage_path: storagePath,
  });
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  await admin.from('document_requests').update({
    stato: 'caricato', documento_id: documentoId, caricato_at: new Date().toISOString(),
  }).eq('id', requestId);

  return NextResponse.json({ ok: true });
}

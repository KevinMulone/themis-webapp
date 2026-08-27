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
  const matterId = form.get('matter_id') as string | null;
  if (!file || !matterId) return NextResponse.json({ error: 'File e pratica sono obbligatori' }, { status: 400 });

  const { data: matter } = await supabase.from('matters').select('id').eq('id', matterId).single();
  if (!matter) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentoId = crypto.randomUUID();
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const storagePath = `documenti/${user.id}/${documentoId}${ext}.enc`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(
    storagePath, encryptBuffer(buffer, user.id), { contentType: 'application/octet-stream', upsert: true },
  );
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error: dbError } = await supabase.from('documenti').insert({
    id: documentoId, studio_id: user.id, matter_id: matterId, nome_file: file.name, storage_path: storagePath,
  });
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  return NextResponse.json({ ok: true, documento_id: documentoId });
}

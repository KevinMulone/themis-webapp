import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer, encryptBuffer } from '@/lib/crypto/docEncryption';

export async function GET() {
  const supabase = await createClient();
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { studioId } = contesto;

  const { data: settings } = await supabase
    .from('studio_settings').select('letterhead_storage_path').eq('studio_id', studioId).single();
  if (!settings?.letterhead_storage_path) return NextResponse.json({ exists: false });

  const admin = createAdminClient();
  const { data: fileData, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(settings.letterhead_storage_path);
  if (error || !fileData) return NextResponse.json({ exists: false });

  const encrypted = Buffer.from(await fileData.arrayBuffer());
  const plaintext = decryptBuffer(encrypted, studioId);
  const dataUrl = `data:image/png;base64,${plaintext.toString('base64')}`;
  return NextResponse.json({ exists: true, data_url: dataUrl });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { studioId } = contesto;

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'File obbligatorio' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Immagine troppo grande (max 8 MB)' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `letterheads/${studioId}.enc`;
  const encrypted = encryptBuffer(buffer, studioId);
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, encrypted, {
    contentType: 'application/octet-stream', upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error: dbError } = await supabase
    .from('studio_settings')
    .upsert({ studio_id: studioId, letterhead_storage_path: storagePath }, { onConflict: 'studio_id' });
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { studioId } = contesto;

  const admin = createAdminClient();
  await admin.storage.from(DOCUMENTS_BUCKET).remove([`letterheads/${studioId}.enc`]);
  await supabase.from('studio_settings').upsert({ studio_id: studioId, letterhead_storage_path: null }, { onConflict: 'studio_id' });
  return NextResponse.json({ ok: true });
}

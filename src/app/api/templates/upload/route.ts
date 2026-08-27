import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { discoverPlaceholders } from '@/lib/discoverPlaceholders';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const nome = (form.get('nome') as string) || '';
  const categoria = (form.get('categoria') as string) || null;
  const descrizione = (form.get('descrizione') as string) || null;
  if (!file || !nome) {
    return NextResponse.json({ error: 'File e nome sono obbligatori' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const placeholderKeys = await discoverPlaceholders(buffer);

  const { data: templateRow, error: insertError } = await supabase
    .from('templates')
    .insert({ studio_id: user.id, nome, categoria, descrizione, storage_path: 'pending' })
    .select('id')
    .single();
  if (insertError || !templateRow) {
    return NextResponse.json({ error: insertError?.message || 'Errore creazione template' }, { status: 400 });
  }

  const storagePath = `templates/${user.id}/${templateRow.id}.docx.enc`;
  const encrypted = encryptBuffer(buffer, user.id);
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, encrypted, {
    contentType: 'application/octet-stream', upsert: true,
  });
  if (uploadError) {
    await supabase.from('templates').delete().eq('id', templateRow.id);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await supabase.from('templates').update({ storage_path: storagePath }).eq('id', templateRow.id);

  if (placeholderKeys.length > 0) {
    const rows = placeholderKeys.map((key, idx) => ({
      template_id: templateRow.id, placeholder_key: key, etichetta: key,
      sorgente: 'manuale', tipo_campo: 'testo', obbligatorio: false, ordine: idx,
    }));
    await supabase.from('template_placeholders').insert(rows);
  }

  return NextResponse.json({ ok: true, template_id: templateRow.id, placeholders: placeholderKeys });
}

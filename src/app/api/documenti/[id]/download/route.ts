import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';

export async function GET(_request: Request, ctx: RouteContext<'/api/documenti/[id]/download'>) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data: documento } = await supabase
    .from('documenti').select('nome_file, storage_path, studio_id').eq('id', id).single();
  if (!documento || documento.studio_id !== user.id) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: fileData, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(documento.storage_path);
  if (error || !fileData) return NextResponse.json({ error: 'File non trovato nello storage' }, { status: 404 });

  const encrypted = Buffer.from(await fileData.arrayBuffer());
  const plaintext = decryptBuffer(encrypted, user.id);

  return new NextResponse(new Uint8Array(plaintext), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(documento.nome_file)}"`,
    },
  });
}

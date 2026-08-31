import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';

export async function GET(_request: Request, ctx: RouteContext<'/api/documenti/[id]/download'>) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data: documento } = await supabase
    .from('documenti').select('nome_file, storage_path, studio_id').eq('id', id).single();
  if (!documento || documento.studio_id !== contesto.studioId) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: fileData, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(documento.storage_path);
  if (error || !fileData) return NextResponse.json({ error: 'File non trovato nello storage' }, { status: 404 });

  const encrypted = Buffer.from(await fileData.arrayBuffer());
  // Si decifra con lo scope della RIGA, non con quello di chi sta
  // scaricando: è il documento a sapere con quale chiave è stato cifrato.
  // Per i file storici il valore è lo stesso (studio_id coincideva con
  // l'id del titolare), e questo resta corretto anche quando a caricare
  // sarà stato un collaboratore o un cliente dal portale.
  const plaintext = decryptBuffer(encrypted, documento.studio_id);

  return new NextResponse(new Uint8Array(plaintext), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(documento.nome_file)}"`,
    },
  });
}

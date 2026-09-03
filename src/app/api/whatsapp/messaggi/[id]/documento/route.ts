import { NextResponse } from 'next/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';

/** Scarica il documento allegato a un messaggio WhatsApp — funziona sia
 *  per quelli già agganciati a una pratica sia per quelli ancora in
 *  attesa di collegamento: la fonte è sempre la riga del messaggio, non
 *  la tabella documenti. */
export async function GET(_request: Request, ctx: RouteContext<'/api/whatsapp/messaggi/[id]/documento'>) {
  const { id } = await ctx.params;
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const admin = createAdminClient();
  const { data: messaggio } = await admin
    .from('whatsapp_messaggi').select('documento_storage_path, documento_nome')
    .eq('id', id).eq('studio_id', contesto.studioId).maybeSingle();
  if (!messaggio || !messaggio.documento_storage_path) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
  }

  const { data: fileData, error } = await admin.storage
    .from(DOCUMENTS_BUCKET).download(messaggio.documento_storage_path);
  if (error || !fileData) return NextResponse.json({ error: 'File non trovato nello storage' }, { status: 404 });

  const encrypted = Buffer.from(await fileData.arrayBuffer());
  const plaintext = decryptBuffer(encrypted, contesto.studioId);
  const nome = messaggio.documento_nome || 'documento';

  return new NextResponse(new Uint8Array(plaintext), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nome)}"`,
    },
  });
}

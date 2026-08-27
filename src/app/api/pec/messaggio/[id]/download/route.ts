import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';

// Scarica il messaggio PEC così com'è arrivato (busta di trasporto completa
// di postacert.eml e daticert.xml): sono questi due file a dare valore
// probatorio alla PEC, per questo si conserva l'originale invece di un
// riassunto.
export async function GET(_request: Request, ctx: RouteContext<'/api/pec/messaggio/[id]/download'>) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data: messaggio } = await supabase
    .from('pec_messaggi').select('oggetto, storage_path_eml, studio_id').eq('id', id).single();
  if (!messaggio || messaggio.studio_id !== user.id) {
    return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: fileData, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(messaggio.storage_path_eml);
  if (error || !fileData) return NextResponse.json({ error: 'File non trovato nello storage' }, { status: 404 });

  const encrypted = Buffer.from(await fileData.arrayBuffer());
  const plaintext = decryptBuffer(encrypted, user.id);
  const nomeFile = `${(messaggio.oggetto || 'messaggio').replace(/[^\w\- ]/g, '_').slice(0, 80)}.eml`;

  return new NextResponse(new Uint8Array(plaintext), {
    headers: {
      'Content-Type': 'message/rfc822',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nomeFile)}"`,
    },
  });
}

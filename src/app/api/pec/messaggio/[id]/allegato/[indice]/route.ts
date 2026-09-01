import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { estraiAllegatoPec } from '@/lib/pec/parse';

export const runtime = 'nodejs';

/** Scarica un singolo allegato del messaggio, estratto al volo dall'originale. */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/pec/messaggio/[id]/allegato/[indice]'>,
) {
  const { id, indice } = await ctx.params;
  const supabase = await createClient();
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data: messaggio } = await supabase
    .from('pec_messaggi').select('storage_path_eml, studio_id').eq('id', id).single();
  if (!messaggio || messaggio.studio_id !== contesto.studioId) {
    return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: file } = await admin.storage.from(DOCUMENTS_BUCKET).download(messaggio.storage_path_eml);
  if (!file) return NextResponse.json({ error: 'File non trovato' }, { status: 404 });

  const sorgente = decryptBuffer(Buffer.from(await file.arrayBuffer()), messaggio.studio_id);
  const allegato = await estraiAllegatoPec(sorgente, Number(indice));
  if (!allegato) return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 });

  const nomeSicuro = allegato.nome.replace(/[^\w.\- ]/g, '_').slice(0, 120);
  return new NextResponse(new Uint8Array(allegato.contenuto), {
    headers: {
      'Content-Type': allegato.tipo,
      'Content-Disposition': `attachment; filename="${nomeSicuro}"`,
    },
  });
}

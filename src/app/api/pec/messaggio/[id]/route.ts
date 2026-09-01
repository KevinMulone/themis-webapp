import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { contestoStudio } from '@/lib/studio/contesto';
import { apriMessaggioPec } from '@/lib/pec/parse';

export const runtime = 'nodejs';

/**
 * Corpo e allegati di un messaggio, per leggerlo senza scaricarlo.
 *
 * Non si salva nulla in più nel database: l'originale cifrato c'è già, e
 * lo si apre al momento. Duplicare il corpo in una colonna significherebbe
 * tenere in chiaro, e per sempre, quello che oggi è cifrato.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/pec/messaggio/[id]'>) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { data: messaggio } = await supabase
    .from('pec_messaggi')
    .select('id, tipo_pec, direzione, storage_path_eml, studio_id')
    .eq('id', id).single();
  if (!messaggio || messaggio.studio_id !== contesto.studioId) {
    return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: file } = await admin.storage.from(DOCUMENTS_BUCKET).download(messaggio.storage_path_eml);
  if (!file) return NextResponse.json({ error: 'File non trovato nello storage' }, { status: 404 });

  try {
    // Scope della riga, non di chi legge.
    const sorgente = decryptBuffer(Buffer.from(await file.arrayBuffer()), messaggio.studio_id);
    const aperto = await apriMessaggioPec(sorgente);

    // Aprirlo è leggerlo: si segna qui e non dal browser, così vale anche
    // se la pagina viene chiusa mentre si legge.
    await admin.from('pec_messaggi').update({ letta: true }).eq('id', messaggio.id);
    return NextResponse.json({ ok: true, ...aperto, tipoPec: messaggio.tipo_pec, direzione: messaggio.direzione });
  } catch (errore) {
    const m = errore instanceof Error ? errore.message : 'Errore imprevisto';
    return NextResponse.json({ error: `Messaggio non leggibile: ${m}` }, { status: 502 });
  }
}

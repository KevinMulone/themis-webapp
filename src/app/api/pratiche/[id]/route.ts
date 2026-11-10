import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, DOCUMENTS_BUCKET } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';

/**
 * Elimina definitivamente una pratica ARCHIVIATA, con tutto ciò che vi è
 * collegato: documenti, incarichi, eventi, richieste (lo fa il database, a
 * cascata) e i file cifrati dei documenti (lo fa questa route).
 *
 * La cancellazione della riga passa dalla sessione dell'utente e non dalla
 * service role: così valgono le regole del database, in particolare quella
 * che riserva l'eliminazione definitiva al titolare. I file si tolgono solo
 * dopo che la riga è sparita, perché un file senza pratica è un residuo,
 * mentre una pratica senza file sarebbe un danno.
 */
export async function DELETE(_request: Request, ctx: RouteContext<'/api/pratiche/[id]'>) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può eliminare definitivamente una pratica' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: pratica } = await supabase.from('matters')
    .select('id, stato').eq('id', id).eq('studio_id', contesto.studioId).maybeSingle();
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 });
  if (pratica.stato !== 'archiviata') {
    return NextResponse.json({ error: 'Si può eliminare solo una pratica archiviata: archiviala prima.' }, { status: 409 });
  }

  const { data: documenti } = await supabase.from('documenti').select('storage_path').eq('matter_id', id);
  const percorsi = (documenti ?? []).map((d) => d.storage_path as string).filter((p) => p && p !== 'pending');

  const { error } = await supabase.from('matters').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Pratica non eliminata: riprova.' }, { status: 500 });

  let fileRimossi = 0;
  if (percorsi.length) {
    const { error: erroreFile } = await createAdminClient().storage.from(DOCUMENTS_BUCKET).remove(percorsi);
    if (!erroreFile) fileRimossi = percorsi.length;
  }

  return NextResponse.json({ ok: true, documenti: percorsi.length, fileRimossi });
}

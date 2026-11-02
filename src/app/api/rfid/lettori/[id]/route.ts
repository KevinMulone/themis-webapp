import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';

/**
 * Revoca un lettore: il suo token smette subito di funzionare. La riga
 * resta, perché posizioni e spostamenti già registrati vi fanno riferimento.
 */
export async function DELETE(_request: Request, ctx: RouteContext<'/api/rfid/lettori/[id]'>) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può scollegare un lettore' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data, error } = await admin.from('rfid_lettori')
    .update({ revocato_at: new Date().toISOString() })
    .eq('id', id).eq('studio_id', contesto.studioId).is('revocato_at', null)
    .select('id');
  if (error) return NextResponse.json({ error: 'Lettore non scollegato' }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'Lettore non trovato' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

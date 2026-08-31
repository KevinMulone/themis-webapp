import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';
import { postiPerPiano } from '@/lib/stripe/plans';

async function titolareOppureErrore() {
  const contesto = await contestoStudio();
  if (!contesto) return { errore: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) };
  if (contesto.ruolo !== 'titolare') {
    return { errore: NextResponse.json({ error: 'Solo il titolare può gestire i collaboratori' }, { status: 403 }) };
  }
  return { contesto };
}

/** Disattiva o riattiva un collaboratore. */
export async function PATCH(request: Request, ctx: RouteContext<'/api/collaboratori/[id]'>) {
  const { errore, contesto } = await titolareOppureErrore();
  if (errore) return errore;

  const { id } = await ctx.params;
  const { stato } = await request.json();
  if (stato !== 'attivo' && stato !== 'disattivato') {
    return NextResponse.json({ error: 'Stato non valido' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membro } = await admin
    .from('studio_membri')
    .select('id, ruolo, stato')
    .eq('id', id)
    .eq('studio_id', contesto!.studioId)
    .maybeSingle();
  if (!membro) return NextResponse.json({ error: 'Collaboratore non trovato' }, { status: 404 });
  if (membro.ruolo === 'titolare') {
    return NextResponse.json({ error: 'Il titolare non può disattivare sé stesso' }, { status: 400 });
  }

  // Riattivare qualcuno consuma un posto: si ricontrolla, perché nel
  // frattempo il piano potrebbe essere cambiato o i posti essersi riempiti.
  if (stato === 'attivo' && membro.stato === 'disattivato') {
    const { data: attuali } = await admin
      .from('studio_membri')
      .select('id, stato')
      .eq('studio_id', contesto!.studioId)
      .eq('ruolo', 'collaboratore');
    const occupati = (attuali || []).filter((m) => m.stato !== 'disattivato').length;
    if (occupati >= postiPerPiano(contesto!.plan)) {
      return NextResponse.json({ error: 'Non ci sono posti liberi nel piano attuale' }, { status: 409 });
    }
  }

  const { error } = await admin
    .from('studio_membri')
    .update({
      stato,
      disattivato_at: stato === 'disattivato' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** Rimozione definitiva: cancella l'account di accesso e la riga in rosa. */
export async function DELETE(_request: Request, ctx: RouteContext<'/api/collaboratori/[id]'>) {
  const { errore, contesto } = await titolareOppureErrore();
  if (errore) return errore;

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: membro } = await admin
    .from('studio_membri')
    .select('id, user_id, ruolo')
    .eq('id', id)
    .eq('studio_id', contesto!.studioId)
    .maybeSingle();
  if (!membro) return NextResponse.json({ error: 'Collaboratore non trovato' }, { status: 404 });
  if (membro.ruolo === 'titolare') {
    return NextResponse.json({ error: 'Il titolare non può essere rimosso' }, { status: 400 });
  }

  if (membro.user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(membro.user_id);
    // Se l'utente Auth non esiste più si prosegue comunque: l'obiettivo è
    // che alla fine non resti nulla, non che ogni singolo passo trovi
    // qualcosa da cancellare.
    if (authError && !authError.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  await admin.from('studio_membri').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}

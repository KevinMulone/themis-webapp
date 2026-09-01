import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';

export const runtime = 'nodejs';

/** Le proposte ancora da decidere, con il messaggio da cui vengono. */
export async function GET() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('pec_proposte')
    .select('id, tipo_proposto, data_proposta, ora_proposta, titolo_proposto, estratto, '
      + 'confidenza, matter_id, pec_messaggio_id, pec_messaggi(oggetto, mittente, data_invio)')
    .eq('studio_id', contesto.studioId)
    .eq('stato', 'in_attesa')
    .order('data_proposta');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, proposte: data ?? [] });
}

/** Accetta (creando l'evento) o rifiuta una proposta. */
export async function PATCH(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { id, azione } = await request.json();
  if (!id || (azione !== 'accetta' && azione !== 'rifiuta')) {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: proposta } = await admin
    .from('pec_proposte').select('*')
    .eq('id', id).eq('studio_id', contesto.studioId).single();
  if (!proposta) return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 });

  if (azione === 'rifiuta') {
    await admin.from('pec_proposte').update({ stato: 'rifiutata' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  // L'evento nasce solo qui, quando un essere umano ha detto di sì.
  const { data: evento, error: erroreEvento } = await admin.from('eventi').insert({
    studio_id: contesto.studioId,
    matter_id: proposta.matter_id,
    titolo: proposta.titolo_proposto,
    tipo: proposta.tipo_proposto === 'udienza' ? 'udienza' : 'termine_processuale',
    data: proposta.data_proposta,
    // Mai all_day: gli eventi di lavoro hanno un orario, e senza finirebbero
    // in cima al giorno senza dire quando.
    all_day: false,
    ora_inizio: proposta.ora_proposta ?? '09:00',
    note: proposta.estratto
      ? `Ricavata da una PEC. Testo di origine: «${proposta.estratto}». Verificare sul messaggio originale.`
      : 'Ricavata da una PEC. Verificare sul messaggio originale.',
  }).select('id').single();
  if (erroreEvento || !evento) {
    return NextResponse.json({ error: erroreEvento?.message ?? 'Evento non creato' }, { status: 400 });
  }

  await admin.from('pec_proposte')
    .update({ stato: 'accettata', evento_id: evento.id }).eq('id', id);

  return NextResponse.json({ ok: true, eventoId: evento.id });
}

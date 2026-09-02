import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';

export const runtime = 'nodejs';

/** Le proposte ancora da decidere. Stesso schema di /api/pec/proposte,
 *  sulla tabella gemella per WhatsApp. */
export async function GET() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('whatsapp_proposte')
    .select('id, tipo_proposto, data_proposta, ora_proposta, titolo_proposto, estratto, '
      + 'confidenza, matter_id, messaggio_id, whatsapp_messaggi(jid_mittente, ricevuto_il)')
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
    .from('whatsapp_proposte').select('*')
    .eq('id', id).eq('studio_id', contesto.studioId).single();
  if (!proposta) return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 });

  if (azione === 'rifiuta') {
    await admin.from('whatsapp_proposte').update({ stato: 'rifiutata' }).eq('id', id);
    return NextResponse.json({ ok: true });
  }

  let assistito = '';
  if (proposta.matter_id) {
    const { data: pratica } = await admin
      .from('matters')
      .select('clients(nome, cognome, ragione_sociale)')
      .eq('id', proposta.matter_id).maybeSingle();
    const c = Array.isArray(pratica?.clients) ? pratica?.clients[0] : pratica?.clients;
    if (c) {
      assistito = [c.cognome, c.nome].filter(Boolean).join(' ') || c.ragione_sociale || '';
    }
  }
  const titolo = assistito && !proposta.titolo_proposto.toLowerCase().includes(assistito.toLowerCase())
    ? `${assistito} — ${proposta.titolo_proposto}`
    : proposta.titolo_proposto;

  const TIPO_EVENTO: Record<string, string> = {
    udienza: 'udienza',
    ctu: 'appuntamento',
    termine: 'termine_processuale',
    scadenza: 'scadenza',
    appuntamento: 'appuntamento',
    altro: 'altro',
  };

  const { data: evento, error: erroreEvento } = await admin.from('eventi').insert({
    studio_id: contesto.studioId,
    matter_id: proposta.matter_id,
    titolo,
    tipo: TIPO_EVENTO[proposta.tipo_proposto] ?? 'altro',
    data: proposta.data_proposta,
    all_day: false,
    ora_inizio: proposta.ora_proposta ?? '09:00',
    note: proposta.estratto
      ? `Ricavata da un messaggio WhatsApp. Testo di origine: «${proposta.estratto}». Verificare sul messaggio originale.`
      : 'Ricavata da un messaggio WhatsApp. Verificare sul messaggio originale.',
  }).select('id').single();
  if (erroreEvento || !evento) {
    return NextResponse.json({ error: erroreEvento?.message ?? 'Evento non creato' }, { status: 400 });
  }

  await admin.from('whatsapp_proposte')
    .update({ stato: 'accettata', evento_id: evento.id }).eq('id', id);

  return NextResponse.json({ ok: true, eventoId: evento.id });
}

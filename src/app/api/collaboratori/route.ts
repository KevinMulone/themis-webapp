import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';
import { postiPerPiano } from '@/lib/stripe/plans';

const GIORNI_VALIDITA_INVITO = 7;

/** Elenco dei membri dello studio, più il conteggio dei posti. */
export async function GET() {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può gestire i collaboratori' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: membri } = await admin
    .from('studio_membri')
    .select('id, email, nome, ruolo, stato, invite_code, created_at, attivato_at')
    .eq('studio_id', contesto.studioId)
    .order('created_at');

  const collaboratori = (membri || []).filter((m) => m.ruolo === 'collaboratore');
  const occupati = collaboratori.filter((m) => m.stato !== 'disattivato').length;

  return NextResponse.json({
    collaboratori,
    posti: postiPerPiano(contesto.plan),
    occupati,
    plan: contesto.plan,
  });
}

/** Crea un invito e restituisce il codice da mettere nel link. */
export async function POST(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  if (contesto.ruolo !== 'titolare') {
    return NextResponse.json({ error: 'Solo il titolare può invitare collaboratori' }, { status: 403 });
  }

  const { email, nome } = await request.json();
  const emailPulita = (email as string | undefined)?.trim().toLowerCase();
  if (!emailPulita) return NextResponse.json({ error: "Inserisci l'email del collaboratore" }, { status: 400 });

  const admin = createAdminClient();

  // Il conteggio dei posti si fa QUI e non nel browser: un controllo lato
  // client è un suggerimento all'interfaccia, non una regola.
  const posti = postiPerPiano(contesto.plan);
  const { data: attuali } = await admin
    .from('studio_membri')
    .select('id, email, stato')
    .eq('studio_id', contesto.studioId)
    .eq('ruolo', 'collaboratore');

  const occupati = (attuali || []).filter((m) => m.stato !== 'disattivato').length;
  if (occupati >= posti) {
    return NextResponse.json({
      error: `Il tuo piano prevede ${posti} ${posti === 1 ? 'collaboratore' : 'collaboratori'} e ${posti === 1 ? 'il posto è' : 'i posti sono'} già occupato/i. Disattiva un collaboratore, oppure passa a un piano con più posti.`,
    }, { status: 409 });
  }

  if ((attuali || []).some((m) => m.email.toLowerCase() === emailPulita && m.stato !== 'disattivato')) {
    return NextResponse.json({ error: 'Questa persona è già nel tuo studio' }, { status: 409 });
  }

  // Una persona può appartenere a un solo studio (user_id è unico), quindi
  // si rifiuta subito con un messaggio chiaro invece di far fallire più
  // avanti la creazione dell'account.
  const { data: altrove } = await admin
    .from('studio_membri')
    .select('id')
    .ilike('email', emailPulita)
    .neq('studio_id', contesto.studioId)
    .not('user_id', 'is', null)
    .maybeSingle();
  if (altrove) {
    return NextResponse.json({ error: 'Questa email è già collegata a un altro studio' }, { status: 409 });
  }

  const code = crypto.randomUUID().replace(/-/g, '');
  const scade = new Date();
  scade.setDate(scade.getDate() + GIORNI_VALIDITA_INVITO);

  const { error } = await admin.from('studio_membri').insert({
    studio_id: contesto.studioId,
    email: emailPulita,
    nome: (nome as string | undefined)?.trim() || null,
    ruolo: 'collaboratore',
    stato: 'invitato',
    invite_code: code,
    invito_scade_at: scade.toISOString(),
    invitato_da: contesto.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, code });
}

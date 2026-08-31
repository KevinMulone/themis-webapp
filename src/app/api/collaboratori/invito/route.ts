import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Dettagli di un invito, per la schermata /unisciti.
 *
 * Passa da qui e non da una lettura diretta della tabella per la stessa
 * ragione che ci ha fatto chiudere la falla su portal_invites: una regola
 * di sicurezza sul database non può filtrare in base a ciò che c'era nella
 * query di chi interroga, quindi "chiunque legge un invito dato il codice"
 * finirebbe per voler dire "chiunque legge tutti gli inviti". Qui il codice
 * è un argomento, e si restituisce solo la riga corrispondente.
 *
 * Non torna mai il codice, né lo studio_id, né altri membri: solo quel
 * minimo che serve a mostrare "sei stato invitato da X, scegli una password".
 */
export async function GET(request: Request) {
  const codice = new URL(request.url).searchParams.get('codice');
  if (!codice) return NextResponse.json({ valido: false, motivo: 'Codice mancante' });

  const admin = createAdminClient();
  const { data: invito } = await admin
    .from('studio_membri')
    .select('email, nome, stato, invito_scade_at, studio_id')
    .eq('invite_code', codice)
    .maybeSingle();

  if (!invito) return NextResponse.json({ valido: false, motivo: 'Invito non valido' });
  if (invito.stato !== 'invitato') {
    return NextResponse.json({ valido: false, motivo: 'Questo invito è già stato usato' });
  }
  if (invito.invito_scade_at && new Date(invito.invito_scade_at) < new Date()) {
    return NextResponse.json({ valido: false, motivo: 'Questo invito è scaduto' });
  }

  const { data: studio } = await admin
    .from('studios').select('nome_studio').eq('id', invito.studio_id).maybeSingle();

  return NextResponse.json({
    valido: true,
    email: invito.email,
    nome: invito.nome,
    nomeStudio: studio?.nome_studio || null,
  });
}

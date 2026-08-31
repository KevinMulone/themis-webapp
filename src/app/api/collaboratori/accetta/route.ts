import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postiPerPiano } from '@/lib/stripe/plans';

/**
 * Accettazione di un invito: crea l'account del collaboratore.
 *
 * L'utente viene creato QUI, lato server, e non con una registrazione dal
 * browser come fa il portale clienti. Il motivo è il trigger
 * handle_new_studio(), che a ogni nuovo utente Supabase Auth crea
 * automaticamente una riga in `studios` con plan nullo: un collaboratore si
 * ritroverebbe uno studio proprio e vuoto accanto a quello vero. Creandolo
 * da qui possiamo cancellare quella riga subito dopo, nella stessa
 * richiesta, invece di lasciarla in giro.
 *
 * Nei metadati NON si mette `invite_code`: è la chiave che fa scattare
 * l'altro trigger, quello del portale clienti, che fallirebbe non trovando
 * un invito corrispondente e bloccherebbe la creazione dell'account.
 */
export async function POST(request: Request) {
  const { codice, nome, password } = await request.json();
  if (!codice || !password) {
    return NextResponse.json({ error: 'Codice e password sono obbligatori' }, { status: 400 });
  }
  if ((password as string).length < 8) {
    return NextResponse.json({ error: 'La password deve avere almeno 8 caratteri' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invito } = await admin
    .from('studio_membri')
    .select('id, studio_id, email, stato, invito_scade_at')
    .eq('invite_code', codice)
    .maybeSingle();

  if (!invito || invito.stato !== 'invitato') {
    return NextResponse.json({ error: 'Invito non valido o già usato' }, { status: 400 });
  }
  if (invito.invito_scade_at && new Date(invito.invito_scade_at) < new Date()) {
    return NextResponse.json({ error: 'Questo invito è scaduto, chiedine uno nuovo' }, { status: 400 });
  }

  // Il piano potrebbe essere cambiato fra l'invio dell'invito e questo
  // momento: si ricontrolla prima di creare davvero l'account.
  const { data: studio } = await admin
    .from('studios').select('plan').eq('id', invito.studio_id).maybeSingle();
  const { data: attuali } = await admin
    .from('studio_membri').select('id, stato')
    .eq('studio_id', invito.studio_id).eq('ruolo', 'collaboratore').eq('stato', 'attivo');
  if ((attuali || []).length >= postiPerPiano(studio?.plan ?? null)) {
    return NextResponse.json({
      error: 'Lo studio non ha più posti disponibili. Contatta il titolare.',
    }, { status: 409 });
  }

  const { data: creato, error: authError } = await admin.auth.admin.createUser({
    email: invito.email,
    password,
    email_confirm: true, // nessuna email di conferma può essere recapitata oggi
  });
  if (authError || !creato?.user) {
    const messaggio = authError?.message?.toLowerCase().includes('already')
      ? 'Esiste già un account con questa email'
      : authError?.message || 'Creazione account non riuscita';
    return NextResponse.json({ error: messaggio }, { status: 400 });
  }

  // La riga studios creata dal trigger un istante fa. Il filtro su plan
  // nullo è la rete di sicurezza: se per qualsiasi motivo quella riga
  // avesse un abbonamento, la cancellazione non fa nulla invece di
  // distruggere uno studio pagante.
  await admin.from('studios').delete().eq('id', creato.user.id).is('plan', null);

  const { error: legameError } = await admin
    .from('studio_membri')
    .update({
      user_id: creato.user.id,
      nome: (nome as string | undefined)?.trim() || null,
      stato: 'attivo',
      attivato_at: new Date().toISOString(),
      invite_code: null,
    })
    .eq('id', invito.id);

  if (legameError) {
    // Senza il legame l'account non apparterrebbe a nessuno studio: meglio
    // annullarlo del tutto che lasciare in giro un accesso orfano.
    await admin.auth.admin.deleteUser(creato.user.id);
    return NextResponse.json({ error: legameError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email: invito.email });
}

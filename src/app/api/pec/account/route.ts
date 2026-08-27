import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptBuffer } from '@/lib/crypto/docEncryption';
import { PEC_KEY_SCOPE_PREFIX } from '@/lib/pec/sync';

// Crea o aggiorna una casella PEC. La password (se presente nel corpo della
// richiesta) non torna mai al browser dopo il salvataggio: viene cifrata qui
// e scritta in pec_credenziali, tabella senza nessuna policy RLS quindi mai
// leggibile né dal client anon né da quello autenticato — solo da questa
// route, che usa la chiave di servizio.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const body = await request.json();
  const { id, etichetta, indirizzo_pec, imap_host, imap_port, imap_user, password } = body as {
    id?: string; etichetta?: string; indirizzo_pec?: string; imap_host?: string;
    imap_port?: number; imap_user?: string; password?: string;
  };
  if (!etichetta || !indirizzo_pec || !imap_host || !imap_port || !imap_user) {
    return NextResponse.json({ error: 'Tutti i campi della casella sono obbligatori' }, { status: 400 });
  }
  if (!id && !password) {
    return NextResponse.json({ error: 'La password è obbligatoria per una nuova casella' }, { status: 400 });
  }

  const payload = { studio_id: user.id, etichetta, indirizzo_pec, imap_host, imap_port, imap_user };
  let accountId = id;

  if (accountId) {
    // L'update passa dal client con RLS attiva: se la riga non è dello
    // studio corrente, la query non trova nulla da aggiornare.
    const { data, error } = await supabase
      .from('pec_account')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: 'Casella non trovata' }, { status: 404 });
  } else {
    const { data, error } = await supabase.from('pec_account').insert(payload).select('id').single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Errore di salvataggio' }, { status: 400 });
    accountId = data.id;
  }

  if (password) {
    const admin = createAdminClient();
    const passwordCifrata = encryptBuffer(Buffer.from(password, 'utf-8'), PEC_KEY_SCOPE_PREFIX + user.id).toString('base64');
    const { error: credError } = await admin.from('pec_credenziali').upsert(
      { pec_account_id: accountId, studio_id: user.id, password_cifrata: passwordCifrata, updated_at: new Date().toISOString() },
      { onConflict: 'pec_account_id' },
    );
    if (credError) return NextResponse.json({ error: credError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: accountId });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Id mancante' }, { status: 400 });

  // Passa dal client con RLS: cancella solo se la casella è dello studio
  // corrente. pec_credenziali/pec_messaggi/pec_proposte sono ON DELETE
  // CASCADE dalla foreign key su pec_account, quindi seguono da sole.
  const { error } = await supabase.from('pec_account').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

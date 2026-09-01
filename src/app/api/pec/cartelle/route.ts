import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';
import { decryptBuffer } from '@/lib/crypto/docEncryption';
import { elencaCartelle } from '@/lib/pec/imap';
import { PEC_KEY_SCOPE_PREFIX } from '@/lib/pec/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Diagnostica: cosa contiene davvero la casella, cartella per cartella. */
export async function GET(request: Request) {
  const contesto = await contestoStudio();
  if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const accountId = new URL(request.url).searchParams.get('id');
  if (!accountId) return NextResponse.json({ error: 'Casella non indicata' }, { status: 400 });

  const admin = createAdminClient();
  // Si filtra per studio: l'id arriva dal browser e non fa fede.
  const { data: account } = await admin
    .from('pec_account')
    .select('id, studio_id, imap_host, imap_port, imap_user')
    .eq('id', accountId).eq('studio_id', contesto.studioId).single();
  if (!account) return NextResponse.json({ error: 'Casella non trovata' }, { status: 404 });

  const { data: credenziali } = await admin
    .from('pec_credenziali').select('password_cifrata').eq('pec_account_id', accountId).single();
  if (!credenziali) return NextResponse.json({ error: 'Credenziali non configurate' }, { status: 400 });

  try {
    const password = decryptBuffer(
      Buffer.from(credenziali.password_cifrata, 'base64'),
      PEC_KEY_SCOPE_PREFIX + account.studio_id,
    ).toString('utf-8');

    const cartelle = await elencaCartelle({
      host: account.imap_host, port: account.imap_port, user: account.imap_user, password,
    });

    const { count } = await admin
      .from('pec_messaggi').select('id', { count: 'exact', head: true })
      .eq('pec_account_id', accountId);

    return NextResponse.json({ ok: true, cartelle, scaricati: count ?? 0 });
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore imprevisto';
    return NextResponse.json({ error: messaggio }, { status: 502 });
  }
}

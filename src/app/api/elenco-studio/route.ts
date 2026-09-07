import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('studios')
    .select('nome_studio, plan, subscription_status, elenco_pubblico, elenco_paese, elenco_via, elenco_citta, elenco_cap, elenco_sito')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({ studio: data || null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const admin = createAdminClient();
  const { data: studio } = await admin
    .from('studios')
    .select('plan, subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (!studio) return NextResponse.json({ error: 'Studio non trovato' }, { status: 404 });
  const premium = studio.plan === 'annuale' && ['active', 'trialing'].includes(studio.subscription_status || '');
  if (!premium) {
    return NextResponse.json({
      error: 'L’elenco pubblico è riservato al piano annuale attivo.',
    }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const elenco_pubblico = !!body.elenco_pubblico;
  const elenco_paese = String(body.elenco_paese || '').trim() || null;
  const elenco_via = String(body.elenco_via || '').trim() || null;
  const elenco_citta = String(body.elenco_citta || '').trim() || null;
  const elenco_cap = String(body.elenco_cap || '').trim() || null;
  const elenco_sito = String(body.elenco_sito || '').trim() || null;

  if (elenco_sito && !/^https?:\/\//i.test(elenco_sito)) {
    return NextResponse.json({ error: 'Il sito deve iniziare con http:// o https://.' }, { status: 400 });
  }

  if (elenco_pubblico && (!elenco_paese || !elenco_via || !elenco_citta)) {
    return NextResponse.json({ error: 'Per pubblicare servono paese, via e città.' }, { status: 400 });
  }

  const { error } = await admin.from('studios').update({
    elenco_pubblico,
    elenco_paese,
    elenco_via,
    elenco_citta,
    elenco_cap,
    elenco_sito,
  }).eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

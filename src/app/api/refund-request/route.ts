import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendRefundRequestEmail } from '@/lib/resend';

const REFUND_WINDOW_DAYS = 4;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: studio } = await admin
    .from('studios')
    .select('nome_studio, email, plan, stripe_customer_id, subscription_started_at, refund_requested_at')
    .eq('id', user.id)
    .single();

  if (!studio?.stripe_customer_id || !studio.subscription_started_at) {
    return NextResponse.json({ error: 'Nessun abbonamento Stripe collegato a questo account' }, { status: 400 });
  }
  if (studio.refund_requested_at) {
    return NextResponse.json({ error: 'Hai già inviato una richiesta di rimborso' }, { status: 400 });
  }

  const scadenza = new Date(studio.subscription_started_at);
  scadenza.setDate(scadenza.getDate() + REFUND_WINDOW_DAYS);
  if (new Date() > scadenza) {
    return NextResponse.json({ error: 'La finestra di 4 giorni per richiedere il rimborso è scaduta' }, { status: 400 });
  }

  await admin.from('studios').update({ refund_requested_at: new Date().toISOString() }).eq('id', user.id);

  await sendRefundRequestEmail({
    nomeStudio: studio.nome_studio,
    email: studio.email,
    plan: studio.plan,
    stripeCustomerId: studio.stripe_customer_id,
  });

  return NextResponse.json({ ok: true });
}

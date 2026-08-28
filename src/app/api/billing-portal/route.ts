import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/client';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!studio?.stripe_customer_id) {
    return NextResponse.json({ error: 'Nessun abbonamento Stripe collegato a questo account' }, { status: 400 });
  }

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const session = await stripe.billingPortal.sessions.create({
    customer: studio.stripe_customer_id,
    return_url: `${siteUrl}/impostazioni`,
  });

  return NextResponse.json({ url: session.url });
}

import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { isPlanKey, priceIdFor } from '@/lib/stripe/plans';

// Nessuna autenticazione richiesta: chi paga potrebbe non essersi ancora
// registrato. Il collegamento allo studio avviene dopo, quando la chiave
// ricevuta via email viene riscattata da un account (vedi api/activate).
export async function POST(request: Request) {
  const { plan } = await request.json();
  if (typeof plan !== 'string' || !isPlanKey(plan)) {
    return NextResponse.json({ error: 'Piano non valido' }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    success_url: `${siteUrl}/attiva?checkout=success`,
    cancel_url: `${siteUrl}/attiva?checkout=cancel`,
    metadata: { plan },
    subscription_data: { metadata: { plan } },
    // Il "merchant of record"/gestione tasse di Stripe (attivo di default su
    // questo account) richiederebbe un tax_code su ogni prodotto: non ci
    // serve per questo caso d'uso, lo disattiviamo esplicitamente.
    managed_payments: { enabled: false },
  });

  return NextResponse.json({ url: session.url });
}

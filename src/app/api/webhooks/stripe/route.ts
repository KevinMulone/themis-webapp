import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS, planKeyFromPriceId } from '@/lib/stripe/plans';
import { generateLicenseKey } from '@/lib/licenseKeyServer';
import { sendLicenseKeyEmail } from '@/lib/resend';
import { addDaysIso } from '@/lib/dateUtils';

// Serve il runtime Node (non Edge): node:crypto e l'SDK Stripe, più il body
// grezzo per verificare la firma dell'evento.
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Firma mancante' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Firma webhook non valida: ${(err as Error).message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotenza: Stripe può reinviare lo stesso evento più volte.
  const { error: insertError } = await admin.from('stripe_webhook_events').insert({ id: event.id, type: event.type });
  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ received: true }); // già processato
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;
      const plan = session.metadata?.plan;
      if (!plan || !(plan in PLANS)) break;
      const planKey = plan as keyof typeof PLANS;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const email = session.customer_details?.email;

      const licenseId = randomUUID().replace(/-/g, '').slice(0, 12);
      const expiresAtSentinel = `DAYS:${PLANS[planKey].days}`;
      const key = generateLicenseKey(licenseId, expiresAtSentinel, planKey);

      await admin.from('issued_licenses').insert({
        license_id: licenseId,
        plan: planKey,
        expires_at: expiresAtSentinel,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      });

      if (email) {
        await sendLicenseKeyEmail({ to: email, key, planLabel: PLANS[planKey].label });
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason !== 'subscription_cycle') break;
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id ?? null;
      if (!subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      const planKey = priceId ? planKeyFromPriceId(priceId) : null;
      if (!planKey) break;

      const customerId = invoice.customer as string;
      const { data: studio } = await admin
        .from('studios')
        .select('subscription_expires_at')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      // Se lo studio non è ancora collegato (il cliente non ha mai
      // riscattato la prima chiave), non c'è nessuna riga da estendere:
      // riceverà comunque i giorni del piano quando finalmente la riscatta.
      if (!studio) break;

      await admin
        .from('studios')
        .update({
          subscription_expires_at: addDaysIso(studio.subscription_expires_at, PLANS[planKey].days),
          subscription_status: 'active',
        })
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const statiSospesi = ['past_due', 'unpaid', 'incomplete_expired', 'canceled'];
      const nuovoStato = statiSospesi.includes(subscription.status) ? 'suspended' : 'active';
      await admin.from('studios').update({ subscription_status: nuovoStato }).eq('stripe_subscription_id', subscription.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await admin.from('studios').update({ subscription_status: 'suspended' }).eq('stripe_subscription_id', subscription.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractLicenseId } from '@/lib/licenseKey';
import { contestoStudio } from '@/lib/studio/contesto';
import { PLANS, isPlanKey } from '@/lib/stripe/plans';
import { addDaysIso } from '@/lib/dateUtils';

export async function POST(request: Request) {
  const { key } = await request.json();
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Inserisci una chiave di licenza' }, { status: 400 });
  }

  let licenseId: string;
  try {
    licenseId = extractLicenseId(key);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Devi essere registrato/collegato per attivare una chiave' }, { status: 401 });
  }

  // Un collaboratore non deve poter riscattare una licenza: si ritroverebbe
  // uno studio proprio accanto a quello a cui appartiene, con conseguenze
  // confuse su dati e fatturazione. L'abbonamento lo gestisce il titolare.
  const contesto = await contestoStudio();
  if (contesto && contesto.ruolo !== 'titolare') {
    return NextResponse.json({
      error: 'Fai già parte di uno studio come collaboratore: l\'abbonamento lo gestisce il titolare.',
    }, { status: 403 });
  }

  const { error } = await supabase.rpc('redeem_license', { p_license_id: licenseId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Se questa chiave è nata da un pagamento Stripe (issued_licenses porta
  // gli id del cliente/abbonamento), è il primo momento in cui esiste sia lo
  // studio (appena creato) sia il collegamento Stripe: li uniamo qui, così i
  // rinnovi automatici (webhook invoice.paid) sapranno quale studio estendere.
  const admin = createAdminClient();
  const { data: link } = await admin
    .from('issued_licenses')
    .select('stripe_customer_id, stripe_subscription_id, plan, expires_at')
    .eq('license_id', licenseId)
    .maybeSingle();

  // La scadenza la calcoliamo qui, esplicitamente, invece di affidarci a
  // come redeem_license() interpreta il formato "DAYS:N" — funzione che
  // vive solo sul database e che non possiamo leggere da qui. Così il
  // comportamento è visibile nel codice e vale allo stesso modo per le
  // chiavi nate da un pagamento Stripe e per quelle generate a mano dal
  // pannello amministratore.
  const daGiorni = /^DAYS:(\d+)$/.exec(link?.expires_at ?? '');
  const giorni = daGiorni
    ? Number(daGiorni[1])
    : (link?.plan && isPlanKey(link.plan) ? PLANS[link.plan].days : null);

  if (link) {
    await admin
      .from('studios')
      .update({
        ...(link.stripe_customer_id
          ? {
              stripe_customer_id: link.stripe_customer_id,
              stripe_subscription_id: link.stripe_subscription_id,
              subscription_started_at: new Date().toISOString(),
            }
          : {}),
        ...(giorni ? { subscription_expires_at: addDaysIso(null, giorni), subscription_status: 'active' } : {}),
      })
      .eq('id', user.id);
  }

  const { data: studio } = await supabase
    .from('studios')
    .select('plan, subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ ok: true, studio });
}

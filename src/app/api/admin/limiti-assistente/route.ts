import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPlanKey } from '@/lib/stripe/plans';

/** Limite mensile per piano, più il consumo del mese in corso. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const admin = createAdminClient();
  const oggi = new Date();
  const mese = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-01`;

  const [{ data: limiti }, { data: consumo }] = await Promise.all([
    admin.from('limiti_assistente').select('plan, credito_cent'),
    admin.from('ai_utilizzo').select('costo_millesimi, studio_id').eq('mese', mese),
  ]);

  const totaleMillesimi = (consumo ?? []).reduce((s, r) => s + (r.costo_millesimi ?? 0), 0);
  const studiAttivi = new Set((consumo ?? []).map((r) => r.studio_id)).size;

  return NextResponse.json({
    limiti: limiti ?? [],
    consumoMese: { totaleMillesimi, studiAttivi, richieste: (consumo ?? []).length },
  });
}

/** Cambia il limite di un piano. */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { plan, creditoCent } = await request.json();
  if (typeof plan !== 'string' || !isPlanKey(plan)) {
    return NextResponse.json({ error: 'Piano non valido' }, { status: 400 });
  }
  const valore = Number(creditoCent);
  // Il tetto superiore non è pedanteria: protegge da uno zero di troppo
  // digitato per sbaglio, che qui si tradurrebbe in denaro vero.
  if (!Number.isInteger(valore) || valore < 0 || valore > 100_000) {
    return NextResponse.json({ error: 'Valore fuori intervallo (0 – 1.000 €)' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('limiti_assistente')
    .upsert({ plan, credito_cent: valore, updated_at: new Date().toISOString() }, { onConflict: 'plan' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

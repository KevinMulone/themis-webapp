import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPlanKey } from '@/lib/stripe/plans';

type Riga = { studio_id: string; mese: string; costo_millesimi: number | null };

/** Limite mensile per piano, più il consumo (mese in corso e totale). */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const admin = createAdminClient();
  const oggi = new Date();
  const mese = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-01`;

  // Si legge tutto lo storico e si somma qui: con i numeri di oggi sono
  // poche righe. Se un giorno diventassero decine di migliaia, il posto
  // giusto per sommare è una vista materializzata su Postgres, non questa
  // funzione.
  const [{ data: limiti }, { data: righe }, { data: studi }] = await Promise.all([
    admin.from('limiti_assistente').select('plan, credito_cent'),
    admin.from('ai_utilizzo').select('studio_id, mese, costo_millesimi'),
    admin.from('studios').select('id, nome_studio, email, plan'),
  ]);

  const nomi = new Map((studi ?? []).map((s) => [s.id, s]));

  type Conto = {
    studioId: string; nome: string; plan: string | null;
    meseMillesimi: number; meseRichieste: number;
    totaleMillesimi: number; totaleRichieste: number;
  };
  const perStudio = new Map<string, Conto>();

  for (const r of (righe ?? []) as Riga[]) {
    let c = perStudio.get(r.studio_id);
    if (!c) {
      const s = nomi.get(r.studio_id);
      c = {
        studioId: r.studio_id,
        // Uno studio cancellato lascia comunque il suo consumo nei conti:
        // il denaro è stato speso davvero, e nasconderlo falserebbe il totale.
        nome: s?.nome_studio || s?.email || 'studio eliminato',
        plan: s?.plan ?? null,
        meseMillesimi: 0, meseRichieste: 0, totaleMillesimi: 0, totaleRichieste: 0,
      };
      perStudio.set(r.studio_id, c);
    }
    const costo = r.costo_millesimi ?? 0;
    c.totaleMillesimi += costo;
    c.totaleRichieste += 1;
    if (r.mese === mese) { c.meseMillesimi += costo; c.meseRichieste += 1; }
  }

  const elenco = [...perStudio.values()].sort((a, b) => b.totaleMillesimi - a.totaleMillesimi);

  return NextResponse.json({
    limiti: limiti ?? [],
    consumoMese: {
      totaleMillesimi: elenco.reduce((s, c) => s + c.meseMillesimi, 0),
      richieste: elenco.reduce((s, c) => s + c.meseRichieste, 0),
      studiAttivi: elenco.filter((c) => c.meseRichieste > 0).length,
    },
    consumoTotale: {
      totaleMillesimi: elenco.reduce((s, c) => s + c.totaleMillesimi, 0),
      richieste: elenco.reduce((s, c) => s + c.totaleRichieste, 0),
      studi: elenco.length,
    },
    perStudio: elenco,
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
  // Centesimi di dollaro, come tutto il conteggio dell'assistente.
  if (!Number.isInteger(valore) || valore < 0 || valore > 100_000) {
    return NextResponse.json({ error: 'Valore fuori intervallo (0 – 1.000 $)' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('limiti_assistente')
    .upsert({ plan, credito_cent: valore, updated_at: new Date().toISOString() }, { onConflict: 'plan' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

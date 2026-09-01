import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { contestoStudio } from '@/lib/studio/contesto';
import { creditoAiMensileCent } from '@/lib/stripe/plans';
import { aiConfigurata } from '@/lib/ai/claude';

export const runtime = 'nodejs';

/**
 * Perché Themis dice «non disponibile».
 *
 * Rifà passo per passo lo stesso calcolo del tetto di spesa, ma invece di
 * restituire solo sì/no mostra ogni valore intermedio. Esiste perché
 * abbiamo passato mezz'ora a indovinare quale dei quattro passaggi
 * fallisse: adesso lo dice lui.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const contesto = await contestoStudio();
  if (!contesto) {
    return NextResponse.json({ passo: 'contesto', esito: 'nessuno studio risolto per questo utente' });
  }

  const admin = createAdminClient();
  const oggi = new Date();
  const mese = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-01`;

  const consumo = await admin
    .from('ai_utilizzo').select('costo_millesimi')
    .eq('studio_id', contesto.studioId).eq('mese', mese);

  const limite = contesto.plan
    ? await admin.from('limiti_assistente').select('credito_cent').eq('plan', contesto.plan).maybeSingle()
    : { data: null, error: null };

  const dalCodice = creditoAiMensileCent(contesto.plan);
  const totaleCent = limite.data?.credito_cent ?? dalCodice;

  return NextResponse.json({
    chiaveApiPresente: aiConfigurata(),
    studioId: contesto.studioId,
    ruolo: contesto.ruolo,
    planDalContesto: contesto.plan,
    meseCercato: mese,
    letturaConsumo: {
      errore: consumo.error?.message ?? null,
      righe: consumo.data?.length ?? null,
    },
    letturaLimite: {
      errore: limite.error?.message ?? null,
      creditoCentTrovato: limite.data?.credito_cent ?? null,
    },
    creditoDaCostanteNelCodice: dalCodice,
    totaleApplicato: totaleCent,
    // Se questo è true, Themis si nega. Le righe sopra dicono perché.
    siNega: !!consumo.error || totaleCent <= 0,
  });
}

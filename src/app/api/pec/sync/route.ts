import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sincronizzaAccount } from '@/lib/pec/sync';
import { contestoStudio } from '@/lib/studio/contesto';

export const runtime = 'nodejs';
/** Un giro scarica al massimo dieci messaggi, ma ciascuno va decifrato,
 *  ricifrato e caricato: due minuti sono un margine onesto. */
export const maxDuration = 120;

// Chiamata da due possibili "mittenti":
// 1. Il cron esterno (pg_cron/pg_net su Supabase, o il cron di Vercel), con
//    "Authorization: Bearer <CRON_SECRET>" — sincronizza TUTTE le caselle
//    attive di TUTTI gli studi.
// 2. L'utente loggato dal pulsante "Sincronizza ora" in Impostazioni —
//    sincronizza solo le caselle del proprio studio.
// In nessun caso questa route fida di un id-studio passato dal chiamante:
// o lo decide la sessione autenticata, o si sincronizza tutto (uso interno,
// protetto dal segreto).
export async function POST(request: Request) {
  const admin = createAdminClient();
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const chiamataDalCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  let studioId: string | null = null;
  if (!chiamataDalCron) {
    const contesto = await contestoStudio();
    if (!contesto) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    studioId = contesto.studioId;
  }

  let query = admin.from('pec_account').select('id').eq('attivo', true);
  if (studioId) query = query.eq('studio_id', studioId);
  const { data: accounts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 'nuovi' porta le PEC recenti, 'arretrato' scende nel passato.
  // Il valore di riserva è 'nuovi': è quello che serve quasi sempre.
  let modo: 'nuovi' | 'arretrato' = 'nuovi';
  let azzera = false;
  try {
    const corpo = await request.json();
    if (corpo?.modo === 'arretrato') modo = 'arretrato';
    azzera = corpo?.azzera === true;
  } catch {
    // Nessun corpo: va bene, si resta su 'nuovi'.
  }

  // Rilettura da capo: si riportano i segnalibri all'inizio. Non crea
  // doppioni, perché l'unicità su (casella, cartella, uid) fa scartare da
  // sola ciò che c'è già: si reinseriscono solo i messaggi mancanti.
  if (azzera) {
    // Solo le caselle che questa richiesta ha già il diritto di vedere:
    // `accounts` è stato filtrato per studio poche righe sopra.
    const ids = (accounts ?? []).map((a) => a.id);
    if (ids.length > 0) {
      await admin.from('pec_cartelle')
        .update({ last_seen_uid: 0, arretrato_fino_a: null })
        .in('pec_account_id', ids);
    }
  }

  const risultati = [];
  for (const account of accounts ?? []) {
    risultati.push(await sincronizzaAccount(admin, account.id, modo));
  }

  return NextResponse.json({ ok: true, risultati });
}

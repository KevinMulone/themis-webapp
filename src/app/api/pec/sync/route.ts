import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sincronizzaAccount } from '@/lib/pec/sync';

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    studioId = user.id;
  }

  let query = admin.from('pec_account').select('id').eq('attivo', true);
  if (studioId) query = query.eq('studio_id', studioId);
  const { data: accounts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const risultati = [];
  for (const account of accounts ?? []) {
    risultati.push(await sincronizzaAccount(admin, account.id));
  }

  return NextResponse.json({ ok: true, risultati });
}

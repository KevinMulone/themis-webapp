import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Client con la service role key: bypassa la Row Level Security, usato SOLO
// in Route Handler/codice server per leggere e scrivere lo Storage (dopo aver
// verificato a mano, con il client normale, che chi chiama sia autorizzato a
// vedere quella riga). Il pacchetto "server-only" fa fallire la build se
// questo file finisse per sbaglio in un bundle lato browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const DOCUMENTS_BUCKET = 'documents';

import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Verifica che l'utente loggato sia esattamente l'email admin configurata
 * server-side (mai fidarsi di un flag "isAdmin" passato dal client). Ritorna
 * null se autorizzato, altrimenti un messaggio di errore da restituire. */
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return 'Non autorizzato';
  }
  return null;
}

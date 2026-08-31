import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ContestoStudio, Ruolo } from './tipi';

type RigaContesto = {
  studio_id: string;
  ruolo: string;
  nome_studio: string | null;
  plan: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
};

/**
 * Lo studio per cui l'utente loggato sta lavorando, e con quale ruolo.
 *
 * Sostituisce la vecchia domanda "qual è la riga studios con id =
 * user.id", che valeva solo finché un utente era per forza uno studio.
 * La risoluzione vera avviene in Postgres (funzione `contesto_studio()`,
 * migrazione 005), così è la stessa identica logica a valere per le regole
 * di sicurezza del database, per l'app e per la generazione atti in Python.
 *
 * Ritorna null quando l'utente non appartiene a nessuno studio attivo:
 * non autenticato, registrato ma senza licenza riscattata, oppure
 * collaboratore disattivato. Chi chiama decide dove mandarlo.
 */
export async function contestoStudio(): Promise<ContestoStudio | null> {
  const supabase = await createClient();
  // Il middleware ha già verificato la sessione con una vera chiamata di
  // rete per questa richiesta: getSession() legge il cookie già firmato,
  // senza rifare lo stesso giro (vedi lo stesso ragionamento nel layout).
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data } = await supabase.rpc('contesto_studio').maybeSingle();
  const riga = data as RigaContesto | null;
  if (!riga) return null;

  return {
    userId: user.id,
    studioId: riga.studio_id,
    ruolo: riga.ruolo as Ruolo,
    nomeStudio: riga.nome_studio,
    plan: riga.plan,
    subscriptionStatus: riga.subscription_status,
    subscriptionExpiresAt: riga.subscription_expires_at,
  };
}

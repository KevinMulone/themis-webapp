import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { numeriEquivalenti } from './numero';

export type Abbinamento = { clienteId: string | null; matterId: string | null };

/**
 * Il cliente (e, se c'è una sola pratica non archiviata, la pratica)
 * corrispondenti a un numero WhatsApp. Stessa logica usata sia per i
 * messaggi di testo sia per i documenti allegati — un solo posto dove
 * decidere "di chi è questo numero", non due copie che potrebbero
 * disallinearsi nel tempo.
 */
export async function trovaClienteEPratica(
  admin: SupabaseClient, studioId: string, numero: string,
): Promise<Abbinamento> {
  const { data: clienti } = await admin
    .from('clients').select('id, telefono').eq('studio_id', studioId).not('telefono', 'is', null);
  const trovato = (clienti ?? []).find((c) => c.telefono && numeriEquivalenti(c.telefono, numero));
  if (!trovato) return { clienteId: null, matterId: null };

  // Solo se la pratica è UNA: indovinare fra due sarebbe sbagliare tanto
  // quanto non collegare nulla.
  const { data: pratiche } = await admin
    .from('matters').select('id').eq('client_id', trovato.id).neq('stato', 'archiviata').limit(2);
  const matterId = pratiche && pratiche.length === 1 ? pratiche[0].id : null;

  return { clienteId: trovato.id, matterId };
}

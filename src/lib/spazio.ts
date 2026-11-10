import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  LIMITE_FILE_BYTES, MB, QUOTA_STORAGE_MB, SOGLIA_STOP, formattaMB, messaggioFileTroppoGrande,
} from '@/lib/spazioCostanti';

/**
 * Controllo da fare prima di scrivere un file nello Storage.
 *
 * Ritorna una risposta di errore (da restituire così com'è) se il file è troppo grande o se lo
 * spazio sta per finire; altrimenti null. Se non riesce a leggere lo spazio usato (per esempio la
 * migrazione 043 non è ancora applicata) lascia passare: un controllo di sicurezza non deve
 * diventare la ragione per cui non si riesce più a caricare nulla.
 */
export async function verificaCaricamento(dimensione: number): Promise<NextResponse | null> {
  if (dimensione > LIMITE_FILE_BYTES) {
    return NextResponse.json({ error: messaggioFileTroppoGrande(dimensione) }, { status: 413 });
  }
  try {
    const quota = Number(process.env.QUOTA_STORAGE_MB) > 0 ? Number(process.env.QUOTA_STORAGE_MB) : QUOTA_STORAGE_MB;
    const { data, error } = await createAdminClient().rpc('spazio_usato');
    if (error || !data) return null;
    const usato = Number((data as { storage_bytes?: number }).storage_bytes ?? 0);
    if ((usato + dimensione) / (quota * MB) >= SOGLIA_STOP) {
      return NextResponse.json({
        error: `Lo spazio dello studio è quasi esaurito (${formattaMB(usato)} su ${formattaMB(quota * MB)}). ` +
          'Per non bloccare Themis, i nuovi caricamenti sono sospesi: elimina pratiche o documenti che non servono, o avvisa il titolare.',
      }, { status: 507 });
    }
  } catch {
    // vedi sopra: nel dubbio si lascia caricare
  }
  return null;
}

/**
 * Limiti di spazio e di dimensione dei file. Senza 'server-only': li usano anche le pagine.
 *
 * Le quote sono quelle del piano gratuito di Supabase (1 GB di file, 500 MB di database).
 * Se un giorno il piano cambia, si possono correggere con le variabili d'ambiente
 * QUOTA_STORAGE_MB e QUOTA_DATABASE_MB (lato server) senza toccare il codice.
 */
export const QUOTA_STORAGE_MB = 1024;
export const QUOTA_DATABASE_MB = 500;

/** Oltre questa soglia si avvisa (giallo) e poi si avvisa con più forza (rosso). */
export const SOGLIA_AVVISO = 0.7;
export const SOGLIA_ALLARME = 0.9;
/** Oltre questa soglia il server rifiuta nuovi caricamenti: Supabase si blocca al 100%, e allora non si può più fare nulla. */
export const SOGLIA_STOP = 0.95;

/**
 * Dimensione massima di un file caricato. Vercel non accetta richieste più grandi di 4,5 MB:
 * senza questo limite un file di 6 MB darebbe un errore incomprensibile; così si dice chiaramente cosa fare.
 */
export const LIMITE_FILE_BYTES = 4 * 1024 * 1024;

export const MB = 1024 * 1024;

export function formattaMB(bytes: number): string {
  const mb = bytes / MB;
  return mb >= 1000 ? `${(mb / 1024).toFixed(2).replace('.', ',')} GB` : `${mb.toFixed(mb < 10 ? 1 : 0).replace('.', ',')} MB`;
}

export function messaggioFileTroppoGrande(bytes: number): string {
  return `Il file pesa ${formattaMB(bytes)}: il massimo è ${formattaMB(LIMITE_FILE_BYTES)}. ` +
    'Riduci la scansione (risoluzione più bassa) o comprimi il PDF, poi riprova.';
}

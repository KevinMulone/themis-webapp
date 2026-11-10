import Link from 'next/link';
import { MB, QUOTA_DATABASE_MB, QUOTA_STORAGE_MB, SOGLIA_ALLARME, SOGLIA_AVVISO, formattaMB } from '@/lib/spazioCostanti';

/**
 * Banner in cima alle pagine, solo per il titolare, quando lo spazio di Supabase si sta riempiendo
 * (giallo dal 70%, rosso dal 90%). Sotto il 70% non si vede. Riceve i numeri già letti dal layout.
 */
export default function AvvisoSpazio({ storageBytes, databaseBytes }: { storageBytes: number; databaseBytes: number }) {
  const sStorage = storageBytes / (QUOTA_STORAGE_MB * MB);
  const sDatabase = databaseBytes / (QUOTA_DATABASE_MB * MB);
  const frazione = Math.max(sStorage, sDatabase);
  if (frazione < SOGLIA_AVVISO) return null;
  const rosso = frazione >= SOGLIA_ALLARME;
  const cosa = sStorage >= sDatabase
    ? `documenti ${formattaMB(storageBytes)} su ${formattaMB(QUOTA_STORAGE_MB * MB)}`
    : `dati ${formattaMB(databaseBytes)} su ${formattaMB(QUOTA_DATABASE_MB * MB)}`;
  return (
    <div
      role="status"
      className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
        rosso ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'
      }`}
    >
      <span>
        <b>{rosso ? 'Spazio quasi finito' : 'Lo spazio si sta riempiendo'}</b> — {cosa} ({Math.round(frazione * 100)}%).
        {rosso ? ' A breve Themis potrebbe bloccarsi.' : ''}
      </span>
      <Link href="/impostazioni#spazio" className="font-semibold underline">Vedi lo spazio</Link>
    </div>
  );
}

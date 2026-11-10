'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  MB, QUOTA_DATABASE_MB, QUOTA_STORAGE_MB, SOGLIA_ALLARME, SOGLIA_AVVISO, formattaMB,
} from '@/lib/spazioCostanti';

type Spazio = { storage_bytes: number; database_bytes: number };

/** Colore della barra: verde finché c'è spazio, giallo dal 70%, rosso dal 90%. */
export function coloreSpazio(frazione: number): { barra: string; testo: string } {
  if (frazione >= SOGLIA_ALLARME) return { barra: 'bg-red-500', testo: 'text-red-700' };
  if (frazione >= SOGLIA_AVVISO) return { barra: 'bg-amber-500', testo: 'text-amber-700' };
  return { barra: 'bg-emerald-500', testo: 'text-emerald-700' };
}

function Barra({ titolo, usato, quotaMB }: { titolo: string; usato: number; quotaMB: number }) {
  const frazione = usato / (quotaMB * MB);
  const colori = coloreSpazio(frazione);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-neutral-800">{titolo}</span>
        <span className={`tabular-nums ${colori.testo}`}>
          {formattaMB(usato)} su {formattaMB(quotaMB * MB)} · {Math.min(100, Math.round(frazione * 100))}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100" role="progressbar"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(frazione * 100))} aria-label={titolo}>
        <div className={`h-full rounded-full ${colori.barra}`} style={{ width: `${Math.min(100, Math.max(1, frazione * 100))}%` }} />
      </div>
    </div>
  );
}

export default function ContatoreSpazio() {
  const supabase = useMemo(() => createClient(), []);
  const [spazio, setSpazio] = useState<Spazio | null>(null);
  const [nonDisponibile, setNonDisponibile] = useState(false);

  useEffect(() => {
    supabase.rpc('spazio_usato').then(({ data, error }) => {
      if (error || !data) setNonDisponibile(true);
      else setSpazio(data as Spazio);
    });
  }, [supabase]);

  // Funzione non ancora creata nel database (migrazione 043): la sezione non si mostra, senza rumore.
  if (nonDisponibile) return null;

  const piena = spazio && Math.max(spazio.storage_bytes / (QUOTA_STORAGE_MB * MB), spazio.database_bytes / (QUOTA_DATABASE_MB * MB));
  return (
    <div id="spazio" className="scroll-mt-24 mb-4 rounded-2xl bg-white p-6 ring-1 ring-black/[0.04]">
      <h2 className="mb-1 font-semibold text-neutral-900">Spazio usato</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Il piano gratuito di Supabase concede {formattaMB(QUOTA_STORAGE_MB * MB)} di documenti e {formattaMB(QUOTA_DATABASE_MB * MB)} di dati.
        Quando uno dei due finisce, Themis si blocca finché non si libera spazio.
      </p>
      {!spazio ? (
        <p className="text-sm text-neutral-400">Calcolo in corso…</p>
      ) : (
        <div className="space-y-4">
          <Barra titolo="Documenti e file" usato={spazio.storage_bytes} quotaMB={QUOTA_STORAGE_MB} />
          <Barra titolo="Dati (clienti, pratiche, calendario)" usato={spazio.database_bytes} quotaMB={QUOTA_DATABASE_MB} />
          {piena !== null && piena >= SOGLIA_AVVISO && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Lo spazio si sta riempiendo. Per liberarlo: in <b>Pratiche → Archiviate</b> elimina quelle che non servono più
              (i documenti collegati si cancellano con la pratica) e, prima, controlla che il backup nel Dropbox sia aggiornato.
            </p>
          )}
          <p className="text-xs text-neutral-400">
            I file caricati possono pesare al massimo {formattaMB(4 * MB)}: le foto vengono rimpicciolite da sole, i PDF più pesanti vanno compressi.
            Al 95% dello spazio i nuovi caricamenti si sospendono, per non arrivare al blocco.
          </p>
        </div>
      )}
    </div>
  );
}

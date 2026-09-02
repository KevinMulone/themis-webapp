'use client';

import { useEffect } from 'react';

/**
 * Schermata mostrata quando qualcosa va storto nell'area riservata.
 *
 * Senza questo file Next.js mostra una pagina generica ("questa pagina non
 * si è caricata") che non dice nulla né all'utente né a chi deve
 * correggere: l'errore resta solo nella console del browser, cioè
 * praticamente invisibile a chi sta usando l'app.
 */
export default function ErroreStudio({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Errore area studio:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl bg-neutral-50 p-8">
        <h1 className="mb-1 font-semibold text-red-700">Qualcosa non ha funzionato</h1>
        <p className="mb-4 text-sm text-neutral-600">
          La pagina non è riuscita a caricarsi. I tuoi dati non sono stati toccati.
        </p>

        <div className="mb-4 rounded-md bg-neutral-50 p-3">
          <p className="mb-1 text-xs font-medium text-neutral-500">Dettaglio tecnico</p>
          <p className="break-words font-mono text-xs text-neutral-700">
            {error.message || 'Errore senza messaggio'}
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-[11px] text-neutral-400">codice: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={reset}
            className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
          >
            Riprova
          </button>
          <a
            href="/dashboard"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Torna alla dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

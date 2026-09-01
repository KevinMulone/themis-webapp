'use client';

import { useEffect, useState } from 'react';

type Allegato = { indice: number; nome: string; tipo: string; dimensione: number };
type Aperto = {
  mittente: string | null; destinatari: string | null; oggetto: string | null;
  dataInvio: string | null; corpoTesto: string | null; corpoHtml: string | null;
  allegati: Allegato[];
};

function peso(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Legge un messaggio senza scaricarlo.
 *
 * Si mostra il testo semplice e non l'HTML, anche quando l'HTML c'è: una
 * PEC arriva da chiunque, e rendere il suo HTML dentro la nostra pagina
 * significherebbe eseguire markup altrui nella sessione dell'avvocato.
 * Chi vuole il messaggio esattamente com'è, scarica il .eml — che resta
 * l'unico documento con valore probatorio.
 */
export default function LetturaMessaggio({ messaggioId, onChiudi }: {
  messaggioId: string; onChiudi: () => void;
}) {
  const [dati, setDati] = useState<Aperto | null>(null);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    let vivo = true;
    setDati(null); setErrore('');
    fetch(`/api/pec/messaggio/${messaggioId}`)
      .then((r) => r.json())
      .then((b) => {
        if (!vivo) return;
        if (b.error) setErrore(b.error); else setDati(b);
      })
      .catch(() => vivo && setErrore('Non è stato possibile aprire il messaggio.'));
    return () => { vivo = false; };
  }, [messaggioId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-semibold text-neutral-900">
            {dati?.oggetto || (errore ? 'Messaggio' : 'Apertura...')}
          </h2>
          <button onClick={onChiudi} className="shrink-0 text-sm text-neutral-500 hover:text-neutral-800">
            Chiudi
          </button>
        </div>

        {errore && <p className="text-sm text-red-600">{errore}</p>}
        {!dati && !errore && <p className="text-sm text-neutral-500">Lettura del messaggio...</p>}

        {dati && (
          <>
            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-600">
              <dt className="text-neutral-400">Da</dt><dd>{dati.mittente || '—'}</dd>
              <dt className="text-neutral-400">A</dt><dd>{dati.destinatari || '—'}</dd>
              <dt className="text-neutral-400">Data</dt>
              <dd>{dati.dataInvio ? new Date(dati.dataInvio).toLocaleString('it-IT') : '—'}</dd>
            </dl>

            <div className="max-h-150 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-4">
              {dati.corpoTesto?.trim()
                ? <p className="whitespace-pre-wrap text-sm text-neutral-800">{dati.corpoTesto}</p>
                : <p className="text-sm italic text-neutral-400">
                    Il messaggio non ha testo semplice.{dati.corpoHtml && ' Il contenuto è in formato HTML: scarica il .eml per vederlo com’è.'}
                  </p>}
            </div>

            {dati.allegati.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium text-neutral-500">
                  Allegati ({dati.allegati.length})
                </p>
                <ul className="space-y-1">
                  {dati.allegati.map((a) => (
                    <li key={a.indice} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-neutral-700">{a.nome}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-neutral-400">{peso(a.dimensione)}</span>
                        <a
                          href={`/api/pec/messaggio/${messaggioId}/allegato/${a.indice}`}
                          className="text-xs font-semibold text-bordeaux-700 hover:underline"
                        >
                          Scarica
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
              <p className="text-[11px] text-neutral-500">
                Il file .eml originale è l&apos;unico con valore probatorio: contiene la busta di
                trasporto e la firma del gestore.
              </p>
              <a
                href={`/api/pec/messaggio/${messaggioId}/download`}
                className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Scarica il .eml
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

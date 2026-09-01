'use client';

import { useEffect, useRef, useState } from 'react';
import CreditoBarra, { type Credito } from './CreditoBarra';

type Documento = { id: string; nome_file: string };
type Citazione = { documento: string | null; testo: string | null; pagina: number | null };
type Messaggio = {
  ruolo: 'utente' | 'themis';
  testo: string;
  citazioni?: Citazione[];
};

/** I formati che il server sa leggere. Gli altri non si offrono nemmeno. */
function leggibile(nomeFile: string): boolean {
  const ext = nomeFile.slice(nomeFile.lastIndexOf('.') + 1).toLowerCase();
  return ['pdf', 'docx', 'txt', 'md'].includes(ext);
}

export default function ChiediAlFascicolo({ matterId, documenti }: {
  matterId: string; documenti: Documento[];
}) {
  const [domanda, setDomanda] = useState('');
  const [scelti, setScelti] = useState<string[]>([]);
  const [mostraDocumenti, setMostraDocumenti] = useState(false);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [inCorso, setInCorso] = useState(false);
  const [credito, setCredito] = useState<Credito | null>(null);
  const [errore, setErrore] = useState('');
  const fondo = useRef<HTMLDivElement>(null);

  const allegabili = documenti.filter((d) => leggibile(d.nome_file));

  useEffect(() => {
    if (messaggi.length) fondo.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messaggi, inCorso]);

  async function handleChiedi(e: React.FormEvent) {
    e.preventDefault();
    const testo = domanda.trim();
    if (!testo || inCorso) return;

    // Lo storico che si manda è quello PRIMA di questa domanda: la
    // domanda nuova viaggia a parte, ed è il server a incastrarla in fondo.
    const storico = messaggi.map((m) => ({ ruolo: m.ruolo, testo: m.testo }));
    setMessaggi([...messaggi, { ruolo: 'utente', testo }]);
    setDomanda('');
    setErrore('');
    setInCorso(true);

    const res = await fetch('/api/themis/domanda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matterId, domanda: testo, documentiIds: scelti, storico }),
    });
    const body = await res.json();
    setInCorso(false);

    if (!res.ok) { setErrore(body.error || 'Richiesta non riuscita'); return; }
    setMessaggi((precedenti) => [...precedenti, {
      ruolo: 'themis', testo: body.testo, citazioni: body.citazioni || [],
    }]);
    setCredito(body.credito || null);
  }

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-900">Chiedi a Themis</h2>
          <p className="mt-1 max-w-xl text-xs text-neutral-500">
            Themis è l&apos;intelligenza artificiale dello studio: legge il fascicolo e risponde
            soltanto su ciò che vi trova, indicando da quale documento viene ogni affermazione.
            Risponde solo su questioni giuridiche: fuori da quelle non entra.
          </p>
        </div>
        <CreditoBarra credito={credito} />
      </div>

      {allegabili.length > 0 && (
        <div className="mb-3 mt-3">
          <button
            type="button" onClick={() => setMostraDocumenti(!mostraDocumenti)}
            className="text-xs font-medium text-bordeaux-700 hover:underline"
          >
            {scelti.length === 0
              ? 'Nessun documento allegato alla conversazione — scegli quali'
              : `${scelti.length} document${scelti.length === 1 ? 'o allegato' : 'i allegati'} — modifica`}
          </button>
          {mostraDocumenti && (
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
              {allegabili.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={scelti.includes(d.id)}
                    onChange={(e) => setScelti(
                      e.target.checked ? [...scelti, d.id] : scelti.filter((x) => x !== d.id),
                    )}
                  />
                  <span className="truncate">{d.nome_file}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {messaggi.length > 0 && (
        <div className="mb-3 max-h-150 space-y-4 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-4">
          {messaggi.map((m, i) => m.ruolo === 'utente' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-bordeaux-700 px-4 py-2 text-sm text-white">
                {m.testo}
              </p>
            </div>
          ) : (
            <div key={i}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{m.testo}</p>
              {m.citazioni && m.citazioni.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-xs font-medium text-neutral-500">Da dove viene la risposta</p>
                  <ul className="space-y-1.5 text-xs text-neutral-500">
                    {m.citazioni.map((c, j) => (
                      <li key={j} className="border-l-2 border-neutral-300 pl-2">
                        <span className="font-medium text-neutral-600">
                          {c.documento || 'documento'}{c.pagina ? `, p. ${c.pagina}` : ''}
                        </span>
                        {c.testo && <span className="block italic">«{c.testo.trim()}»</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {inCorso && (
            <p className="text-sm italic text-neutral-400">Themis sta leggendo il fascicolo...</p>
          )}
          <div ref={fondo} />
        </div>
      )}

      <form onSubmit={handleChiedi} className="flex flex-col gap-2">
        <textarea
          value={domanda}
          onChange={(e) => setDomanda(e.target.value)}
          onKeyDown={(e) => {
            // Invio manda, Maiusc+Invio va a capo: è quello che le dita si
            // aspettano da una chat.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChiedi(e); }
          }}
          placeholder={messaggi.length
            ? 'Fai un’altra domanda...'
            : 'Es. Che cosa dice la CTU sulla percentuale di invalidità?'}
          className="min-h-16 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {errore && <p className="text-sm text-red-600">{errore}</p>}
        <div className="flex items-center justify-between gap-3">
          {messaggi.length > 0 ? (
            <button
              type="button"
              onClick={() => { setMessaggi([]); setErrore(''); }}
              className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
            >
              Nuova conversazione
            </button>
          ) : <span />}
          <button
            type="submit" disabled={inCorso || !domanda.trim()}
            className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
          >
            {inCorso ? 'Sto leggendo...' : 'Chiedi a Themis'}
          </button>
        </div>
      </form>

      {messaggi.length > 0 && (
        <p className="mt-3 rounded-md bg-gold-100 px-3 py-2 text-[11px] text-gold-700">
          Themis può sbagliare: verifica sempre sui documenti originali prima di usare
          queste risposte in un atto. La responsabilità di ciò che firmi resta tua.
        </p>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

type Documento = { id: string; nome_file: string };
type Citazione = { documento: string | null; testo: string | null; pagina: number | null };
type Credito = { usatoMillesimi: number; totaleMillesimi: number; residuoMillesimi: number; esaurito: boolean };

function importo(millesimi: number): string {
  return `${(millesimi / 1000).toFixed(2).replace('.', ',')} $`;
}

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
  const [inCorso, setInCorso] = useState(false);
  const [risposta, setRisposta] = useState<{ testo: string; citazioni: Citazione[] } | null>(null);
  const [credito, setCredito] = useState<Credito | null>(null);
  const [errore, setErrore] = useState('');

  const allegabili = documenti.filter((d) => leggibile(d.nome_file));

  async function handleChiedi(e: React.FormEvent) {
    e.preventDefault();
    if (!domanda.trim()) return;
    setErrore('');
    setRisposta(null);
    setInCorso(true);
    const res = await fetch('/api/themis/domanda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matterId, domanda, documentiIds: scelti }),
    });
    const body = await res.json();
    setInCorso(false);
    if (!res.ok) { setErrore(body.error || 'Richiesta non riuscita'); return; }
    setRisposta({ testo: body.testo, citazioni: body.citazioni || [] });
    setCredito(body.credito || null);
  }

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-neutral-900">Chiedi a Themis</h2>
        {credito && (
          <span className="text-xs text-neutral-400">
            Credito: {importo(credito.residuoMillesimi)} di {importo(credito.totaleMillesimi)}
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        Themis è l&apos;intelligenza artificiale dello studio: legge il fascicolo e risponde
        soltanto su ciò che vi trova, indicando sempre da quale documento viene ogni
        affermazione. I documenti che selezioni vengono inviati a un servizio esterno per
        l&apos;elaborazione.
      </p>

      {allegabili.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-neutral-500">
            Documenti da allegare {scelti.length > 0 && `(${scelti.length} selezionati)`}
          </p>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
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
        </div>
      )}

      <form onSubmit={handleChiedi} className="flex flex-col gap-3">
        <textarea
          value={domanda}
          onChange={(e) => setDomanda(e.target.value)}
          placeholder="Es. Che cosa dice la CTU sulla percentuale di invalidità?"
          className="min-h-20 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {errore && <p className="text-sm text-red-600">{errore}</p>}
        <div className="flex justify-end">
          <button
            type="submit" disabled={inCorso || !domanda.trim()}
            className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
          >
            {inCorso ? 'Themis sta leggendo il fascicolo...' : 'Chiedi a Themis'}
          </button>
        </div>
      </form>

      {risposta && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="whitespace-pre-wrap text-sm text-neutral-800">{risposta.testo}</p>

          {risposta.citazioni.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-neutral-500">Da dove viene la risposta</p>
              <ul className="space-y-1.5 text-xs text-neutral-500">
                {risposta.citazioni.map((c, i) => (
                  <li key={i} className="border-l-2 border-neutral-200 pl-2">
                    <span className="font-medium text-neutral-600">
                      {c.documento || 'documento'}{c.pagina ? `, p. ${c.pagina}` : ''}
                    </span>
                    {c.testo && <span className="block italic">«{c.testo.trim()}»</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 rounded-md bg-gold-100 px-3 py-2 text-[11px] text-gold-700">
            Themis può sbagliare: verifica sempre sui documenti originali prima di usare
            questa risposta in un atto. La responsabilità di ciò che firmi resta tua.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { TIPI_ATTO, tipoAtto } from '@/lib/ai/tipiAtto';
import CreditoBarra, { type Credito } from './CreditoBarra';

type Documento = { id: string; nome_file: string };
type Esito = {
  testo: string;
  note: string;
  salvato: { documentoId: string; nomeFile: string } | null;
};

function leggibile(nomeFile: string): boolean {
  const ext = nomeFile.slice(nomeFile.lastIndexOf('.') + 1).toLowerCase();
  return ['pdf', 'docx', 'txt', 'md'].includes(ext);
}

/**
 * Il pannello si apre da solo o su richiesta di chi lo contiene.
 *
 * `apertura` e `onApertura` sono facoltativi: se non arrivano, il pannello
 * si gestisce da sé come ha sempre fatto dentro la pratica. Servono alla
 * pagina Themis, dove una scorciatoia deve poterlo aprire — e una
 * scorciatoia che si limita a scorrere fino a un pannello chiuso non è
 * una scorciatoia.
 */
export default function RedigiAtto({ matterId, documenti, onSalvato, apertura, onApertura }: {
  matterId: string;
  documenti: Documento[];
  onSalvato?: () => void;
  apertura?: boolean;
  onApertura?: (v: boolean) => void;
}) {
  const [apertoInterno, setApertoInterno] = useState(false);
  const controllato = apertura !== undefined;
  const aperto = controllato ? apertura : apertoInterno;
  const setAperto = (v: boolean) => {
    if (controllato) onApertura?.(v);
    else setApertoInterno(v);
  };
  const [tipo, setTipo] = useState(TIPI_ATTO[0].chiave);
  const [istruzioni, setIstruzioni] = useState('');
  const [scelti, setScelti] = useState<string[]>([]);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [credito, setCredito] = useState<Credito | null>(null);
  const [errore, setErrore] = useState('');
  const [copiato, setCopiato] = useState(false);

  const allegabili = documenti.filter((d) => leggibile(d.nome_file));
  const scelto = tipoAtto(tipo);

  async function handleRedigi(e: React.FormEvent) {
    e.preventDefault();
    setErrore('');
    setEsito(null);
    setInCorso(true);
    const res = await fetch('/api/themis/bozza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matterId, tipo, istruzioni, documentiIds: scelti }),
    });
    const body = await res.json();
    setInCorso(false);
    if (!res.ok) { setErrore(body.error || 'Richiesta non riuscita'); return; }
    setEsito({ testo: body.testo, note: body.note, salvato: body.salvato });
    setCredito(body.credito || null);
    if (body.salvato) onSalvato?.();
  }

  async function copia() {
    if (!esito) return;
    await navigator.clipboard.writeText(esito.testo);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2000);
  }

  return (
    <div className="mb-4 rounded-xl bg-neutral-50 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-neutral-900">Fai preparare un atto a Themis</h2>
        <div className="flex items-center gap-4">
          <CreditoBarra credito={credito} />
          <button
            type="button" onClick={() => setAperto(!aperto)}
            className="text-sm font-medium text-bordeaux-700 hover:underline"
          >
            {aperto ? 'Chiudi' : 'Apri'}
          </button>
        </div>
      </div>

      {!aperto ? (
        <p className="mt-1 text-xs text-neutral-500">
          Themis prepara la prima stesura di una diffida, di un ricorso, di una memoria o di
          una procura, seguendo la struttura degli atti dello studio.
        </p>
      ) : (
        <>
          <p className="mb-4 mt-1 text-xs text-neutral-500">
            Themis scrive seguendo la struttura degli atti dello studio e prende i fatti solo
            dal fascicolo. Quella che ottieni è comunque una <strong>prima stesura da
            rivedere</strong>, non un atto da depositare. I documenti selezionati vengono
            inviati a un servizio esterno per l&apos;elaborazione.
          </p>

          <form onSubmit={handleRedigi} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Tipo di atto</label>
              <select
                value={tipo} onChange={(e) => { setTipo(e.target.value); setEsito(null); }}
                className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              >
                {TIPI_ATTO.map((t) => <option key={t.chiave} value={t.chiave}>{t.label}</option>)}
              </select>
              {scelto && <p className="mt-1 text-xs text-neutral-400">{scelto.aiuto}</p>}
            </div>

            {allegabili.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  Documenti da tenere presenti {scelti.length > 0 && `(${scelti.length} selezionati)`}
                </label>
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
                <p className="mt-1 text-xs text-neutral-400">
                  Da qui vengono presi i fatti: senza documenti, l&apos;atto si regge solo sui
                  dati della scheda pratica.
                </p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Istruzioni {scelto?.chiave === 'libero' ? '(obbligatorie)' : '(facoltative)'}
              </label>
              <textarea
                value={istruzioni}
                onChange={(e) => setIstruzioni(e.target.value)}
                placeholder="Es. Insistere sulla responsabilità del custode ex art. 2051 c.c. e chiedere il risarcimento anche delle spese mediche già documentate. Termine di 15 giorni."
                className="min-h-24 w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              />
              <p className="mt-1 text-xs text-neutral-400">
                Più sei preciso qui, meno dovrai riscrivere dopo: taglio della difesa, termini,
                importi, cosa lasciare fuori.
              </p>
            </div>

            {errore && <p className="text-sm text-red-600">{errore}</p>}

            <div className="flex justify-end">
              <button
                type="submit" disabled={inCorso}
                className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                {inCorso ? 'Themis sta preparando l’atto...' : 'Prepara la bozza'}
              </button>
            </div>
          </form>

          {esito && (
            <div className="mt-5 border-t border-neutral-200 pt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-neutral-500">
                  {esito.salvato
                    ? `Salvata nel fascicolo come «${esito.salvato.nomeFile}»`
                    : 'Bozza pronta (non è stato possibile salvarla nel fascicolo)'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button" onClick={copia}
                    className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    {copiato ? 'Copiato' : 'Copia il testo'}
                  </button>
                  {esito.salvato && (
                    <a
                      href={`/api/documenti/${esito.salvato.documentoId}/download`}
                      className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
                    >
                      Scarica in Word
                    </a>
                  )}
                </div>
              </div>

              <div className="max-h-150 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-neutral-800">
                  {esito.testo}
                </p>
              </div>

              {esito.note && (
                <div className="mt-3 rounded-md border border-gold-300 bg-gold-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-gold-800">Da controllare prima di firmare</p>
                  <p className="whitespace-pre-wrap text-xs text-gold-700">{esito.note}</p>
                </div>
              )}

              <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-[11px] text-neutral-600">
                Themis non produce riferimenti a sentenze, per scelta: dove servirebbe trovi
                un segnaposto da riempire tu. Gli articoli di legge citati vanno riscontrati.
                La responsabilità di ciò che depositi resta tua.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

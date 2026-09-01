'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

type Proposta = {
  id: string;
  tipo_proposto: string;
  data_proposta: string;
  ora_proposta: string | null;
  titolo_proposto: string;
  estratto: string | null;
  confidenza: string;
  matter_id: string | null;
  pec_messaggi?: { oggetto: string | null; mittente: string | null; data_invio: string | null };
};

function dataIt(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

/**
 * Le scadenze che Themis ha trovato nelle PEC, in attesa di una decisione.
 *
 * Nessuna finisce in calendario da sola. Una data sbagliata inserita in
 * silenzio non la si controlla mai più, e ci si accorge del guaio quando
 * il termine è passato: per questo ogni proposta mostra la frase esatta
 * da cui viene, e aspetta un sì.
 */
export default function ScadenzeProposte() {
  const [proposte, setProposte] = useState<Proposta[]>([]);
  const [analisi, setAnalisi] = useState(false);
  const [messaggio, setMessaggio] = useState('');
  const [inCorso, setInCorso] = useState('');

  const carica = useCallback(async () => {
    const res = await fetch('/api/pec/proposte');
    if (!res.ok) return;
    const body = await res.json();
    setProposte(body.proposte || []);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  async function analizza() {
    setAnalisi(true);
    setMessaggio('');
    const res = await fetch('/api/themis/scadenze', { method: 'POST' });
    const body = await res.json();
    setAnalisi(false);
    if (!res.ok) { setMessaggio(body.error || 'Analisi non riuscita'); return; }
    setMessaggio(body.esaminati === 0 && !body.falliti
      ? 'Nessuna PEC nuova da esaminare.'
      : `${body.esaminati} PEC lette, ${body.proposte} scadenze trovate.`
        + (body.falliti ? ` ${body.falliti} non analizzate: riprova fra un momento.` : '')
        + (body.restanti > 0 ? ` Altre ${body.restanti} da esaminare: premi di nuovo.` : ''));
    carica();
  }

  async function decidi(id: string, azione: 'accetta' | 'rifiuta') {
    setInCorso(id);
    await fetch('/api/pec/proposte', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, azione }),
    });
    setInCorso('');
    carica();
  }

  return (
    <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-60 flex-1 gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
            <Icon nome="pec" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold text-neutral-900">
              Scadenze trovate nelle PEC
              {proposte.length > 0 && (
                <span className="rounded-full bg-bordeaux-700 px-2 py-0.5 text-xs text-white">
                  {proposte.length}
                </span>
              )}
            </h2>
            {messaggio ? (
              <p className="mt-0.5 text-sm text-neutral-600">{messaggio}</p>
            ) : proposte.length === 0 ? (
              <p className="mt-0.5 text-sm text-neutral-500">
                Nessuna proposta in attesa. Premi <strong>Cerca scadenze</strong> e Themis leggerà
                le PEC non ancora esaminate.
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-neutral-500">
                Controlla la frase di origine prima di aggiungerle al calendario.
              </p>
            )}
          </div>
        </div>
        <button
          type="button" onClick={analizza} disabled={analisi}
          className="shrink-0 rounded-lg border border-bordeaux-700 px-4 py-2.5 text-sm font-medium text-bordeaux-700 transition-colors hover:bg-bordeaux-50 disabled:opacity-50"
        >
          {analisi ? 'Themis sta leggendo...' : 'Cerca scadenze'}
        </button>
      </div>

      {proposte.length === 0 ? null : (
        <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
          {proposte.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-60 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-900">{p.titolo_proposto}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                      {({
                        udienza: 'Udienza', ctu: 'CTU', termine: 'Termine processuale',
                        scadenza: 'Scadenza', appuntamento: 'Appuntamento', altro: 'Altro',
                      } as Record<string, string>)[p.tipo_proposto] ?? p.tipo_proposto}
                    </span>
                    {p.confidenza === 'bassa' && (
                      <span
                        className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] text-gold-700"
                        title="La data non era scritta per esteso: Themis l'ha calcolata o dedotta. Controllala."
                      >
                        da verificare
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-bordeaux-800">
                    {dataIt(p.data_proposta)}{p.ora_proposta ? `, ore ${p.ora_proposta.slice(0, 5)}` : ''}
                  </p>
                  {p.estratto && (
                    <p className="mt-1 border-l-2 border-neutral-200 pl-2 text-xs italic text-neutral-500">
                      «{p.estratto}»
                    </p>
                  )}
                  {p.pec_messaggi?.oggetto && (
                    <p className="mt-1 text-[11px] text-neutral-400">
                      da: {p.pec_messaggi.mittente ?? '—'} · {p.pec_messaggi.oggetto}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button" disabled={inCorso === p.id}
                    onClick={() => decidi(p.id, 'accetta')}
                    className="rounded-md bg-bordeaux-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                  >
                    Aggiungi al calendario
                  </button>
                  <button
                    type="button" disabled={inCorso === p.id}
                    onClick={() => decidi(p.id, 'rifiuta')}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Scarta
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {proposte.length > 0 && (
        <p className="mt-3 text-[11px] text-neutral-500">
          La sospensione feriale non è applicata: dipende dalla materia, ed è esclusa per lavoro e
          previdenza. Per il calcolo usa lo strumento nella pratica, che porta i riferimenti normativi.
        </p>
      )}
    </div>
  );
}

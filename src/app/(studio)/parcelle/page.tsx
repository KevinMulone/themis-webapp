'use client';

import { useMemo, useState } from 'react';
import { TABELLE, calcolaCompensi } from '@/lib/parametriForensi';

function euro(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export default function ParcellePage() {
  const [tabellaId, setTabellaId] = useState(TABELLE[1].id);
  const tabella = TABELLE.find((t) => t.id === tabellaId)!;

  const [valore, setValore] = useState(26_000);
  const [fasiSelezionate, setFasiSelezionate] = useState<boolean[]>(tabella.fasi.map(() => true));
  const [variazionePct, setVariazionePct] = useState(0);
  const [includiRimborsoForfettario, setIncludiRimborsoForfettario] = useState(true);
  const [includiCpa, setIncludiCpa] = useState(true);
  const [includiIva, setIncludiIva] = useState(true);

  function selezionaTabella(id: string) {
    const nuova = TABELLE.find((t) => t.id === id)!;
    setTabellaId(id);
    setFasiSelezionate(nuova.fasi.map(() => true));
  }

  function toggleFase(i: number) {
    setFasiSelezionate(fasiSelezionate.map((v, idx) => (idx === i ? !v : v)));
  }

  const risultato = useMemo(() => {
    return calcolaCompensi({
      tabella, valore, fasiSelezionate, variazionePct,
      includiRimborsoForfettario, includiCpa, includiIva,
    });
  }, [tabella, valore, fasiSelezionate, variazionePct, includiRimborsoForfettario, includiCpa, includiIva]);

  const scaglione = tabella.scaglioni[risultato.scaglioneIndice];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-display font-semibold text-neutral-900">Calcolo parcella (parametri forensi)</h1>
      <p className="mb-6 text-xs text-neutral-500">
        D.M. 55/2014, tabelle come sostituite dal D.M. 147/2022 (in vigore dal 23.10.2022).
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-neutral-50 p-6">
          <h2 className="mb-4 font-semibold text-neutral-900">Dati della prestazione</h2>

          <div className="mb-4">
            <label className="mb-1 block text-xs text-neutral-500">Tipo di procedimento</label>
            <select
              value={tabellaId} onChange={(e) => selezionaTabella(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            >
              {TABELLE.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-neutral-400">{tabella.riferimento}</p>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs text-neutral-500">Valore della causa/affare (€)</label>
            <input
              type="number" min={0} step="any" value={valore}
              onChange={(e) => setValore(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Se il valore è indeterminabile, si considera di regola non inferiore a {euro(26_000)} e non
              superiore a {euro(260_000)} (fino a {euro(520_000)} per affari di particolare importanza) — art. 5
              (giudiziale) / art. 21 (stragiudiziale).
            </p>
          </div>

          <div className="mb-4 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
            Scaglione applicato: da {euro(scaglione.min)} a {euro(scaglione.max)}
            {risultato.oltreTetto && (
              <p className="mt-1 text-gold-700">
                Il valore inserito supera {euro(tabella.scaglioni[tabella.scaglioni.length - 1].max)}: per gli
                importi superiori si applica un aumento percentuale progressivo (art. 6 per il giudiziale, art. 22
                per lo stragiudiziale), non calcolato automaticamente qui. È mostrato il valore dell&apos;ultimo
                scaglione a titolo di riferimento minimo.
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs text-neutral-500">Fasi da liquidare</label>
            <div className="space-y-1">
              {tabella.fasi.map((fase, i) => (
                <label key={fase} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={fasiSelezionate[i]} onChange={() => toggleFase(i)} />
                  {fase}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs text-neutral-500">
              Variazione sui valori medi (%) — aumento fino al 50%, diminuzione non oltre il 50%
            </label>
            <input
              type="number" min={-50} max={50} value={variazionePct}
              onChange={(e) => setVariazionePct(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Art. 4, comma 1 (giudiziale) / art. 19 (stragiudiziale), D.M. 55/2014.
            </p>
          </div>

          <div className="space-y-1 border-t border-neutral-200 pt-3">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={includiRimborsoForfettario} onChange={(e) => setIncludiRimborsoForfettario(e.target.checked)} />
              + 15% rimborso spese forfettarie (art. 2)
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={includiCpa} onChange={(e) => setIncludiCpa(e.target.checked)} />
              + 4% Cassa Forense (CPA)
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={includiIva} onChange={(e) => setIncludiIva(e.target.checked)} />
              + 22% IVA
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 p-6">
          <h2 className="mb-4 font-semibold text-neutral-900">Prospetto</h2>
          <div className="space-y-2 text-sm">
            {risultato.righe.length === 0 ? (
              <p className="text-neutral-500">Seleziona almeno una fase.</p>
            ) : (
              risultato.righe.map((r) => (
                <div key={r.fase} className="flex justify-between text-neutral-700">
                  <span>{r.fase}</span>
                  <span>{euro(r.importo)}</span>
                </div>
              ))
            )}

            <div className="flex justify-between border-t border-neutral-200 pt-2 font-medium text-neutral-900">
              <span>Compenso {variazionePct !== 0 ? `(valore medio ${euro(risultato.compensoBase)})` : ''}</span>
              <span>{euro(risultato.compensoConVariazione)}</span>
            </div>

            {includiRimborsoForfettario && (
              <div className="flex justify-between text-neutral-700">
                <span>Rimborso spese forfettarie (15%)</span>
                <span>{euro(risultato.rimborsoForfettario)}</span>
              </div>
            )}
            {includiCpa && (
              <div className="flex justify-between text-neutral-700">
                <span>Cassa Forense (4%)</span>
                <span>{euro(risultato.cpa)}</span>
              </div>
            )}
            {includiIva && (
              <div className="flex justify-between text-neutral-700">
                <span>IVA (22%)</span>
                <span>{euro(risultato.iva)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800">
              <span>Totale</span>
              <span>{euro(risultato.totaleFattura)}</span>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-neutral-400">
            Valore stimato sui parametri medi di legge, non vincolante: il giudice (o l&apos;accordo con il
            cliente) può discostarsene entro i limiti di legge. Non sostituisce la nota spese né la fattura.
          </p>
        </div>
      </div>
    </div>
  );
}

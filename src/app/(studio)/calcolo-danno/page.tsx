'use client';

import { useMemo, useState } from 'react';
import { calcolaDanno, ITT_GIORNALIERO } from '@/lib/tabelleMilano';

type ItpRiga = { id: number; percentuale: number; giorni: number };

function euro(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export default function CalcoloDannoPage() {
  const [eta, setEta] = useState(40);
  const [punti, setPunti] = useState(10);
  const [ittGiorni, setIttGiorni] = useState(0);
  const [itpRighe, setItpRighe] = useState<ItpRiga[]>([]);
  const [speseMediche, setSpeseMediche] = useState(0);
  const [personalizzazione, setPersonalizzazione] = useState(0);
  let nextId = itpRighe.length > 0 ? Math.max(...itpRighe.map((r) => r.id)) + 1 : 1;

  const risultato = useMemo(() => {
    try {
      return calcolaDanno({
        eta, puntiInvalidita: punti, ittGiorni,
        itpTranche: itpRighe.map((r) => ({ percentuale: r.percentuale, giorni: r.giorni })),
        speseMediche, personalizzazionePct: personalizzazione,
      });
    } catch {
      return null;
    }
  }, [eta, punti, ittGiorni, itpRighe, speseMediche, personalizzazione]);

  function addItpRiga() {
    setItpRighe([...itpRighe, { id: nextId, percentuale: 50, giorni: 0 }]);
    nextId += 1;
  }

  function updateItpRiga(id: number, patch: Partial<ItpRiga>) {
    setItpRighe(itpRighe.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeItpRiga(id: number) {
    setItpRighe(itpRighe.filter((r) => r.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold text-neutral-900">Calcolo del danno biologico</h1>
      <p className="mb-6 text-xs text-neutral-500">
        Tabelle di Milano, edizione 2024 (Osservatorio sulla Giustizia Civile di Milano, 4.6.2024).
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-neutral-900">Dati del danneggiato</h2>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Età al momento del fatto</label>
              <input
                type="number" min={1} max={100} value={eta}
                onChange={(e) => setEta(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Invalidità permanente (punti %)</label>
              <input
                type="number" min={1} max={100} value={punti}
                onChange={(e) => setPunti(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs text-neutral-500">
              Giorni di invalidità temporanea totale (100%) — {euro(ITT_GIORNALIERO)}/giorno
            </label>
            <input
              type="number" min={0} value={ittGiorni}
              onChange={(e) => setIttGiorni(Number(e.target.value))}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-neutral-500">Invalidità temporanea parziale</label>
              <button type="button" onClick={addItpRiga} className="text-xs font-semibold text-bordeaux-700 hover:underline">
                + Aggiungi tranche
              </button>
            </div>
            {itpRighe.length === 0 ? (
              <p className="text-xs text-neutral-400">Nessuna tranche di invalidità parziale.</p>
            ) : (
              <div className="space-y-2">
                {itpRighe.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={99} value={r.percentuale}
                      onChange={(e) => updateItpRiga(r.id, { percentuale: Number(e.target.value) })}
                      className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-neutral-500">% per</span>
                    <input
                      type="number" min={0} value={r.giorni}
                      onChange={(e) => updateItpRiga(r.id, { giorni: Number(e.target.value) })}
                      className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-neutral-500">giorni</span>
                    <button type="button" onClick={() => removeItpRiga(r.id)} className="ml-auto text-xs text-red-600 hover:underline">
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs text-neutral-500">Spese mediche documentate (danno emergente)</label>
            <input
              type="number" min={0} step={0.01} value={speseMediche}
              onChange={(e) => setSpeseMediche(Number(e.target.value))}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-500">
              Personalizzazione (%) — scelta discrezionale entro il tetto di legge
            </label>
            <input
              type="number" min={0} max={50} value={personalizzazione}
              onChange={(e) => setPersonalizzazione(Number(e.target.value))}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Il tetto massimo consentito dalle Tabelle di Milano varia dal 25% (invalidità più gravi) al 50%
              (invalidità più lievi); per i sinistri RCA con macropermanente si applica invece il limite dell&apos;art. 138
              c.3 CdA. Verifica sempre il tetto applicabile al caso concreto.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-neutral-900">Prospetto di liquidazione</h2>
          {!risultato ? (
            <p className="text-sm text-red-600">Inserisci un valore di invalidità tra 1 e 100.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="border-b border-neutral-100 pb-2">
                <div className="flex justify-between text-neutral-500">
                  <span>Valore punto (danno biologico)</span>
                  <span>{euro(risultato.valoreA)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Incremento sofferenza soggettiva</span>
                  <span>+{risultato.incrementoSofferenzaPct}%</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Valore punto (A+B)</span>
                  <span>{euro(risultato.valoreB)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Demoltiplicatore età</span>
                  <span>{risultato.demoltiplicatore.toFixed(3)}</span>
                </div>
              </div>

              <div className="flex justify-between font-medium text-neutral-900">
                <span>A — Danno biologico permanente</span>
                <span>{euro(risultato.dannoPermanente)}</span>
              </div>

              {ittGiorni > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>B — ITT 100% ({ittGiorni} gg)</span>
                  <span>{euro(ittGiorni * ITT_GIORNALIERO)}</span>
                </div>
              )}
              {risultato.itpDettaglio.map((t, i) => (
                <div key={i} className="flex justify-between text-neutral-700">
                  <span>ITP {t.percentuale}% ({t.giorni} gg)</span>
                  <span>{euro(t.importo)}</span>
                </div>
              ))}

              {speseMediche > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>C — Spese mediche documentate</span>
                  <span>{euro(speseMediche)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-900">
                <span>Totale senza personalizzazione</span>
                <span>{euro(risultato.totaleSenzaPersonalizzazione)}</span>
              </div>

              {personalizzazione > 0 && (
                <>
                  <div className="flex justify-between text-neutral-700">
                    <span>Personalizzazione +{personalizzazione}% su danno permanente</span>
                    <span>{euro(risultato.personalizzazioneImporto)}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800">
                    <span>Totale con personalizzazione</span>
                    <span>{euro(risultato.totaleConPersonalizzazione)}</span>
                  </div>
                </>
              )}

              {personalizzazione === 0 && (
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800">
                  <span>Totale</span>
                  <span>{euro(risultato.totaleSenzaPersonalizzazione)}</span>
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-[11px] text-neutral-400">
            Valore estimativo, non sostituisce la liquidazione giudiziale. Verificare sempre l&apos;edizione
            delle Tabelle di Milano in vigore al momento dell&apos;uso.
          </p>
        </div>
      </div>
    </div>
  );
}

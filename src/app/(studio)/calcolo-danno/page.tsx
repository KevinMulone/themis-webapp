'use client';

import { useMemo, useState } from 'react';
import { calcolaDanno, ITT_GIORNALIERO } from '@/lib/tabelleMilano';
import {
  calcolaMicropermanente, calcolaMacropermanente, ITT_GIORNALIERO_CIRCOLAZIONE,
  PERSONALIZZAZIONE_MAX_MICROPERMANENTE, PERSONALIZZAZIONE_MAX_MACROPERMANENTE,
  type ItpTranche, type TipoMorale,
} from '@/lib/dannoCircolazione';

type Modalita = 'milano' | 'micropermanente' | 'macropermanente';

function euro(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function useItpRighe() {
  const [righe, setRighe] = useState<(ItpTranche & { id: number })[]>([]);
  let nextId = righe.length > 0 ? Math.max(...righe.map((r) => r.id)) + 1 : 1;
  function aggiungi() { setRighe([...righe, { id: nextId, percentuale: 50, giorni: 0 }]); nextId += 1; }
  function aggiorna(id: number, patch: Partial<ItpTranche>) { setRighe(righe.map((r) => (r.id === id ? { ...r, ...patch } : r))); }
  function rimuovi(id: number) { setRighe(righe.filter((r) => r.id !== id)); }
  return { righe, aggiungi, aggiorna, rimuovi };
}

function CampoItp({ righe, aggiungi, aggiorna, rimuovi }: ReturnType<typeof useItpRighe>) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs text-neutral-500">Invalidità temporanea parziale</label>
        <button type="button" onClick={aggiungi} className="text-xs font-semibold text-bordeaux-700 hover:underline">
          + Aggiungi tranche
        </button>
      </div>
      {righe.length === 0 ? (
        <p className="text-xs text-neutral-400">Nessuna tranche di invalidità parziale.</p>
      ) : (
        <div className="space-y-2">
          {righe.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <input
                type="number" min={1} max={99} value={r.percentuale}
                onChange={(e) => aggiorna(r.id, { percentuale: Number(e.target.value) })}
                className="w-20 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              />
              <span className="text-xs text-neutral-500">% per</span>
              <input
                type="number" min={0} value={r.giorni}
                onChange={(e) => aggiorna(r.id, { giorni: Number(e.target.value) })}
                className="w-24 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              />
              <span className="text-xs text-neutral-500">giorni</span>
              <button type="button" onClick={() => rimuovi(r.id)} className="ml-auto text-xs text-red-600 hover:underline">
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CalcoloDannoPage() {
  const [modalita, setModalita] = useState<Modalita>('milano');

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-display font-semibold text-neutral-900">Calcolo del danno biologico</h1>
      <p className="mb-4 text-xs text-neutral-500">
        Le tabelle di legge (art. 139 e Tabella Unica Nazionale ex art. 138 Cod. Ass.) sono vincolanti per i
        sinistri da circolazione di veicoli a motore e natanti. Le Tabelle di Milano restano il riferimento per i
        danni non da circolazione (es. responsabilità medica prima del 5.3.2025, infortuni non RCA).
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {([
          ['milano', 'Tabelle di Milano'],
          ['micropermanente', 'Art. 139 CdA — micropermanenti (1-9%)'],
          ['macropermanente', 'TUN art. 138 CdA — macropermanenti (10-100%)'],
        ] as [Modalita, string][]).map(([v, label]) => (
          <button
            key={v} onClick={() => setModalita(v)}
            className={`premi rounded-full px-3 py-1.5 text-sm ${modalita === v ? 'bg-bordeaux-700 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {modalita === 'milano' && <CalcolatoreMilano />}
      {modalita === 'micropermanente' && <CalcolatoreMicropermanente />}
      {modalita === 'macropermanente' && <CalcolatoreMacropermanente />}
    </div>
  );
}

function CalcolatoreMilano() {
  const [eta, setEta] = useState(40);
  const [punti, setPunti] = useState(10);
  const [ittGiorni, setIttGiorni] = useState(0);
  const itp = useItpRighe();
  const [speseMediche, setSpeseMediche] = useState(0);
  const [personalizzazione, setPersonalizzazione] = useState(0);

  const risultato = useMemo(() => {
    try {
      return calcolaDanno({
        eta, puntiInvalidita: punti, ittGiorni,
        itpTranche: itp.righe.map((r) => ({ percentuale: r.percentuale, giorni: r.giorni })),
        speseMediche, personalizzazionePct: personalizzazione,
      });
    } catch { return null; }
  }, [eta, punti, ittGiorni, itp.righe, speseMediche, personalizzazione]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-xl bg-neutral-50 p-6">
        <h2 className="mb-1 font-semibold text-neutral-900">Dati del danneggiato</h2>
        <p className="mb-4 text-xs text-neutral-500">Tabelle di Milano, edizione 2024.</p>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Età al momento del fatto</label>
            <input type="number" min={1} max={100} value={eta} onChange={(e) => setEta(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Invalidità permanente (punti %)</label>
            <input type="number" min={1} max={100} value={punti} onChange={(e) => setPunti(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">
            Giorni di invalidità temporanea totale (100%) — {euro(ITT_GIORNALIERO)}/giorno
          </label>
          <input type="number" min={0} value={ittGiorni} onChange={(e) => setIttGiorni(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>

        <CampoItp {...itp} />

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Spese mediche documentate (danno emergente)</label>
          <input type="number" min={0} step={0.01} value={speseMediche} onChange={(e) => setSpeseMediche(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-500">Personalizzazione (%) — scelta discrezionale entro il tetto di legge</label>
          <input type="number" min={0} max={50} value={personalizzazione} onChange={(e) => setPersonalizzazione(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          <p className="mt-1 text-[11px] text-neutral-400">
            Il tetto massimo consentito dalle Tabelle di Milano varia dal 25% (invalidità più gravi) al 50% (invalidità più
            lievi). Verifica sempre il tetto applicabile al caso concreto.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-neutral-50 p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Prospetto di liquidazione</h2>
        {!risultato ? (
          <p className="text-sm text-red-600">Inserisci un valore di invalidità tra 1 e 100.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="border-b border-neutral-100 pb-2">
              <div className="flex justify-between text-neutral-500"><span>Valore punto (danno biologico)</span><span>{euro(risultato.valoreA)}</span></div>
              <div className="flex justify-between text-neutral-500"><span>Incremento sofferenza soggettiva</span><span>+{risultato.incrementoSofferenzaPct}%</span></div>
              <div className="flex justify-between text-neutral-500"><span>Valore punto (A+B)</span><span>{euro(risultato.valoreB)}</span></div>
              <div className="flex justify-between text-neutral-500"><span>Demoltiplicatore età</span><span>{risultato.demoltiplicatore.toFixed(3)}</span></div>
            </div>
            <div className="flex justify-between font-medium text-neutral-900"><span>A — Danno biologico permanente</span><span>{euro(risultato.dannoPermanente)}</span></div>
            {ittGiorni > 0 && <div className="flex justify-between text-neutral-700"><span>B — ITT 100% ({ittGiorni} gg)</span><span>{euro(ittGiorni * ITT_GIORNALIERO)}</span></div>}
            {risultato.itpDettaglio.map((t, i) => (
              <div key={i} className="flex justify-between text-neutral-700"><span>ITP {t.percentuale}% ({t.giorni} gg)</span><span>{euro(t.importo)}</span></div>
            ))}
            {speseMediche > 0 && <div className="flex justify-between text-neutral-700"><span>C — Spese mediche documentate</span><span>{euro(speseMediche)}</span></div>}
            <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-900"><span>Totale senza personalizzazione</span><span>{euro(risultato.totaleSenzaPersonalizzazione)}</span></div>
            {personalizzazione > 0 ? (
              <>
                <div className="flex justify-between text-neutral-700"><span>Personalizzazione +{personalizzazione}% su danno permanente</span><span>{euro(risultato.personalizzazioneImporto)}</span></div>
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800"><span>Totale con personalizzazione</span><span>{euro(risultato.totaleConPersonalizzazione)}</span></div>
              </>
            ) : (
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800"><span>Totale</span><span>{euro(risultato.totaleSenzaPersonalizzazione)}</span></div>
            )}
          </div>
        )}
        <p className="mt-4 text-[11px] text-neutral-400">
          Valore estimativo, non sostituisce la liquidazione giudiziale. Verificare sempre l&apos;edizione delle Tabelle di
          Milano in vigore al momento dell&apos;uso.
        </p>
      </div>
    </div>
  );
}

function CalcolatoreMicropermanente() {
  const [eta, setEta] = useState(40);
  const [punti, setPunti] = useState(5);
  const [ittGiorni, setIttGiorni] = useState(0);
  const itp = useItpRighe();
  const [speseMediche, setSpeseMediche] = useState(0);
  const [personalizzazione, setPersonalizzazione] = useState(0);

  const risultato = useMemo(() => {
    try {
      return calcolaMicropermanente({
        eta, puntiInvalidita: punti, ittGiorni,
        itpTranche: itp.righe.map((r) => ({ percentuale: r.percentuale, giorni: r.giorni })),
        speseMediche, personalizzazionePct: personalizzazione,
      });
    } catch { return null; }
  }, [eta, punti, ittGiorni, itp.righe, speseMediche, personalizzazione]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-xl bg-neutral-50 p-6">
        <h2 className="mb-1 font-semibold text-neutral-900">Dati del danneggiato</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Art. 139 Cod. Ass. — solo per invalidità permanente da 1 a 9 punti da circolazione di veicoli.
        </p>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Età al momento del fatto</label>
            <input type="number" min={0} max={100} value={eta} onChange={(e) => setEta(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Invalidità permanente (punti %, 1-9)</label>
            <input type="number" min={1} max={9} step={0.1} value={punti} onChange={(e) => setPunti(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">
            Giorni di invalidità temporanea totale (100%) — {euro(ITT_GIORNALIERO_CIRCOLAZIONE)}/giorno
          </label>
          <input type="number" min={0} value={ittGiorni} onChange={(e) => setIttGiorni(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>

        <CampoItp {...itp} />

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Spese mediche documentate (danno emergente)</label>
          <input type="number" min={0} step={0.01} value={speseMediche} onChange={(e) => setSpeseMediche(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Personalizzazione (%) — fino al {PERSONALIZZAZIONE_MAX_MICROPERMANENTE * 100}% (art. 139, comma 3)
          </label>
          <input
            type="number" min={0} max={PERSONALIZZAZIONE_MAX_MICROPERMANENTE * 100} value={personalizzazione}
            onChange={(e) => setPersonalizzazione(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Solo se la menomazione incide in modo rilevante su specifici aspetti dinamico-relazionali documentati, o ha
            causato una sofferenza psico-fisica di particolare intensità.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-neutral-50 p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Prospetto di liquidazione</h2>
        {!risultato ? (
          <p className="text-sm text-red-600">L&apos;art. 139 si applica da 1 a 9 punti di invalidità: oltre, usa la Tabella Unica Nazionale.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="border-b border-neutral-100 pb-2">
              <div className="flex justify-between text-neutral-500"><span>Coefficiente moltiplicatore (art. 139, c. 6)</span><span>{risultato.coefficiente.toFixed(3)}</span></div>
              <div className="flex justify-between text-neutral-500"><span>Fattore età</span><span>{risultato.fattoreEta.toFixed(3)}</span></div>
            </div>
            <div className="flex justify-between font-medium text-neutral-900"><span>A — Danno biologico permanente</span><span>{euro(risultato.dannoPermanente)}</span></div>
            {ittGiorni > 0 && <div className="flex justify-between text-neutral-700"><span>B — ITT 100% ({ittGiorni} gg)</span><span>{euro(ittGiorni * ITT_GIORNALIERO_CIRCOLAZIONE)}</span></div>}
            {risultato.itpDettaglio.map((t, i) => (
              <div key={i} className="flex justify-between text-neutral-700"><span>ITP {t.percentuale}% ({t.giorni} gg)</span><span>{euro(t.importo)}</span></div>
            ))}
            {speseMediche > 0 && <div className="flex justify-between text-neutral-700"><span>C — Spese mediche documentate</span><span>{euro(speseMediche)}</span></div>}
            <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-900"><span>Totale senza personalizzazione</span><span>{euro(risultato.totaleSenzaPersonalizzazione)}</span></div>
            {personalizzazione > 0 ? (
              <>
                <div className="flex justify-between text-neutral-700"><span>Personalizzazione +{personalizzazione}% su danno permanente</span><span>{euro(risultato.personalizzazioneImporto)}</span></div>
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800"><span>Totale con personalizzazione</span><span>{euro(risultato.totaleConPersonalizzazione)}</span></div>
              </>
            ) : (
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800"><span>Totale</span><span>{euro(risultato.totaleSenzaPersonalizzazione)}</span></div>
            )}
          </div>
        )}
        <p className="mt-4 text-[11px] text-neutral-400">
          Valori aggiornati D.M. 20.7.2026 (G.U. n. 173/2026), in vigore da aprile 2026. Verificare sempre l&apos;ultimo
          decreto di aggiornamento ISTAT in vigore al momento dell&apos;uso.
        </p>
      </div>
    </div>
  );
}

function CalcolatoreMacropermanente() {
  const [eta, setEta] = useState(40);
  const [punti, setPunti] = useState(20);
  const [tipoMorale, setTipoMorale] = useState<TipoMorale>('medio');
  const [ittGiorni, setIttGiorni] = useState(0);
  const itp = useItpRighe();
  const [incrementoMorale, setIncrementoMorale] = useState(30);
  const [speseMediche, setSpeseMediche] = useState(0);
  const [personalizzazione, setPersonalizzazione] = useState(0);

  const risultato = useMemo(() => {
    try {
      return calcolaMacropermanente({
        eta, puntiInvalidita: punti, tipoMorale, ittGiorni,
        itpTranche: itp.righe.map((r) => ({ percentuale: r.percentuale, giorni: r.giorni })),
        incrementoMoraleTemporaneaPct: incrementoMorale, speseMediche, personalizzazionePct: personalizzazione,
      });
    } catch { return null; }
  }, [eta, punti, tipoMorale, ittGiorni, itp.righe, incrementoMorale, speseMediche, personalizzazione]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-xl bg-neutral-50 p-6">
        <h2 className="mb-1 font-semibold text-neutral-900">Dati del danneggiato</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Tabella Unica Nazionale, D.P.R. 12/2025 — invalidità permanente da 10 a 100 punti, sinistri dal 5.3.2025.
        </p>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Età al momento del fatto</label>
            <input type="number" min={1} max={100} value={eta} onChange={(e) => setEta(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Invalidità permanente (punti %, 10-100)</label>
            <input type="number" min={10} max={100} step={0.1} value={punti} onChange={(e) => setPunti(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Danno morale (Tavola 2)</label>
          <select value={tipoMorale} onChange={(e) => setTipoMorale(e.target.value as TipoMorale)} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
            <option value="nessuno">Non includere (solo danno biologico)</option>
            <option value="minimo">Aumento minimo</option>
            <option value="medio">Aumento medio</option>
            <option value="massimo">Aumento massimo</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">
            Giorni di invalidità temporanea totale (100%) — {euro(ITT_GIORNALIERO_CIRCOLAZIONE)}/giorno
          </label>
          <input type="number" min={0} value={ittGiorni} onChange={(e) => setIttGiorni(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>

        <CampoItp {...itp} />

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Incremento per danno morale su temporanea (30-60%, art. 3 c.2 D.P.R. 12/2025)</label>
          <input type="number" min={30} max={60} value={incrementoMorale} onChange={(e) => setIncrementoMorale(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">Spese mediche documentate (danno emergente)</label>
          <input type="number" min={0} step={0.01} value={speseMediche} onChange={(e) => setSpeseMediche(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Personalizzazione (%) — fino al {PERSONALIZZAZIONE_MAX_MACROPERMANENTE * 100}% (art. 138, comma 3)
          </label>
          <input
            type="number" min={0} max={PERSONALIZZAZIONE_MAX_MACROPERMANENTE * 100} value={personalizzazione}
            onChange={(e) => setPersonalizzazione(Number(e.target.value))} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Solo se la menomazione incide in modo rilevante su specifici aspetti dinamico-relazionali documentati e
            obiettivamente accertati.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-neutral-50 p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Prospetto di liquidazione</h2>
        {!risultato ? (
          <p className="text-sm text-red-600">La TUN si applica da 10 a 100 punti di invalidità: sotto, usa l&apos;art. 139.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="border-b border-neutral-100 pb-2">
              <div className="flex justify-between text-neutral-500"><span>Coefficiente biologico (Tavola 1.A)</span><span>{risultato.coefficienteBiologico.toFixed(3)}</span></div>
              <div className="flex justify-between text-neutral-500"><span>Coefficiente età (Tavola 1.B)</span><span>{risultato.fattoreEta.toFixed(3)}</span></div>
              {risultato.coefficienteMorale !== null && (
                <div className="flex justify-between text-neutral-500"><span>Coefficiente morale (Tavola 2, {tipoMorale})</span><span>+{(risultato.coefficienteMorale * 100).toFixed(1)}%</span></div>
              )}
            </div>
            <div className="flex justify-between text-neutral-700"><span>Danno biologico permanente</span><span>{euro(risultato.dannoBiologicoPermanente)}</span></div>
            {risultato.dannoMoralePermanente > 0 && (
              <div className="flex justify-between text-neutral-700"><span>Danno morale permanente</span><span>{euro(risultato.dannoMoralePermanente)}</span></div>
            )}
            <div className="flex justify-between font-medium text-neutral-900"><span>A — Totale permanente</span><span>{euro(risultato.totalePermanente)}</span></div>
            {ittGiorni > 0 && <div className="flex justify-between text-neutral-700"><span>ITT 100% ({ittGiorni} gg)</span><span>{euro(ittGiorni * ITT_GIORNALIERO_CIRCOLAZIONE)}</span></div>}
            {risultato.itpDettaglio.map((t, i) => (
              <div key={i} className="flex justify-between text-neutral-700"><span>ITP {t.percentuale}% ({t.giorni} gg)</span><span>{euro(t.importo)}</span></div>
            ))}
            <div className="flex justify-between text-neutral-700"><span>B — Temporaneo con incremento morale (+{incrementoMorale}%)</span><span>{euro(risultato.dannoTemporaneoConMorale)}</span></div>
            {speseMediche > 0 && <div className="flex justify-between text-neutral-700"><span>C — Spese mediche documentate</span><span>{euro(speseMediche)}</span></div>}
            <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-900"><span>Totale senza personalizzazione</span><span>{euro(risultato.totaleSenzaPersonalizzazione)}</span></div>
            {personalizzazione > 0 ? (
              <>
                <div className="flex justify-between text-neutral-700"><span>Personalizzazione +{personalizzazione}% su A</span><span>{euro(risultato.personalizzazioneImporto)}</span></div>
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800"><span>Totale con personalizzazione</span><span>{euro(risultato.totaleConPersonalizzazione)}</span></div>
              </>
            ) : (
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-bordeaux-800"><span>Totale</span><span>{euro(risultato.totaleSenzaPersonalizzazione)}</span></div>
            )}
          </div>
        )}
        <p className="mt-4 text-[11px] text-neutral-400">
          Coefficienti dell&apos;Allegato I e II al D.P.R. 13.1.2025, n. 12, verificati sullo schema di decreto
          bollato IVASS; valore del punto e ITT aggiornati con D.M. 20.7.2026. Verificare sempre il testo ufficiale
          in vigore al momento dell&apos;uso.
        </p>
      </div>
    </div>
  );
}

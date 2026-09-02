'use client';

import { useEffect, useMemo, useState } from 'react';

type Comune = [nome: string, sigla: string, cap: string];

/** L'elenco si carica una volta sola per sessione, non a ogni apertura del form. */
let cache: Comune[] | null = null;

/**
 * Città, provincia e CAP come un campo solo.
 *
 * L'elenco dei comuni è quello vero (7.904 voci, con sigla e CAP): sta in
 * public/comuni.json e si scarica solo quando il form serve davvero, non
 * al caricamento dell'app — 224 KB in ogni pagina sarebbero uno spreco.
 *
 * Non si mostrano tutte le voci insieme: si filtrano su ciò che si sta
 * scrivendo e se ne offrono al massimo cinquanta. Un menù con ottomila
 * righe è tecnicamente una tendina e praticamente un muro.
 */
export default function CampoComune({ citta, provincia, cap }: {
  citta?: string | null; provincia?: string | null; cap?: string | null;
}) {
  const [comuni, setComuni] = useState<Comune[]>(cache ?? []);
  const [valCitta, setValCitta] = useState(citta ?? '');
  const [valProv, setValProv] = useState(provincia ?? '');
  const [valCap, setValCap] = useState(cap ?? '');
  const [riconosciuto, setRiconosciuto] = useState(false);

  useEffect(() => {
    if (cache) return;
    let vivo = true;
    fetch('/comuni.json')
      .then((r) => r.json())
      .then((dati: Comune[]) => { cache = dati; if (vivo) setComuni(dati); })
      // Se l'elenco non arriva, i tre campi restano scrivibili a mano:
      // si perde la comodità, non la possibilità di lavorare.
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const suggerimenti = useMemo(() => {
    const q = valCitta.trim().toLowerCase();
    if (q.length < 2 || comuni.length === 0) return [];
    return comuni.filter((c) => c[0].toLowerCase().startsWith(q)).slice(0, 50);
  }, [valCitta, comuni]);

  function scegli(nome: string) {
    setValCitta(nome);
    const trovato = comuni.find((c) => c[0].toLowerCase() === nome.trim().toLowerCase());
    if (trovato) {
      setValProv(trovato[1]);
      // Il CAP si compila solo se è vuoto: nei comuni grandi cambia da via
      // a via, e sovrascrivere quello già inserito sarebbe un danno.
      if (!valCap.trim()) setValCap(trovato[2]);
      setRiconosciuto(true);
    } else {
      setRiconosciuto(false);
    }
  }

  return (
    <>
      <div className="col-span-2">
        <label className="mb-1 block text-xs text-neutral-500">Città</label>
        <input
          name="citta" list="elenco-comuni" autoComplete="off"
          value={valCitta}
          onChange={(e) => scegli(e.target.value)}
          placeholder="Scrivi le prime lettere e scegli dall'elenco"
          className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
        />
        <datalist id="elenco-comuni">
          {suggerimenti.map((c) => <option key={`${c[0]}-${c[1]}`} value={c[0]} />)}
        </datalist>
        <p className="mt-1 text-[11px] text-neutral-400">
          {riconosciuto
            ? 'Provincia e CAP compilati dall’elenco ufficiale dei comuni.'
            : 'Scegliendo dall’elenco, provincia e CAP si compilano da soli.'}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs text-neutral-500">Provincia</label>
        <input
          name="provincia" value={valProv} maxLength={2}
          onChange={(e) => setValProv(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="CL"
          className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm uppercase outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
        />
        <p className="mt-1 text-[11px] text-neutral-400">Sigla di due lettere</p>
      </div>

      <div>
        <label className="mb-1 block text-xs text-neutral-500">CAP</label>
        <input
          name="cap" value={valCap} inputMode="numeric" maxLength={5}
          onChange={(e) => setValCap(e.target.value.replace(/\D/g, '').slice(0, 5))}
          className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
        />
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Piantina dello studio: le stanze con i fascicoli che le antenne vi hanno
 * letto, e l'editor per disegnarla (trascina per spostare, quadratino in
 * basso a destra per ridimensionare, cerchi numerati = antenne del lettore).
 * Stessa logica dell'app "Fascicoli RFID" del Mac.
 */

export type Stanza = {
  nome: string; x: number; y: number; w: number; h: number;
  antenna: number | null; ax?: number; ay?: number; corridoio?: boolean;
};
export type Antenna = { antenna: number; nome: string; attiva: boolean; uscita: boolean };
export type FascicoloInStanza = { epc: string; titolo: string; visto: string; perso: boolean; uscito: boolean };

type Props = {
  stanze: Stanza[];
  antenne: Antenna[];
  perAntenna: Map<number, FascicoloInStanza[]>;
  nonRilevati: number;
  puoModificare: boolean;
  onSalva: (stanze: Stanza[]) => Promise<string | null>;
};

const COLORI = ['#8a1c3c', '#1d6fb8', '#2f8f5b', '#b7791f', '#6b46c1', '#c05621', '#0e7490', '#be185d'];
const colore = (antenna: number | null) => (antenna === null ? '#9ca3af' : COLORI[antenna % COLORI.length]);
const GRIGLIA = 10;
const aGriglia = (v: number) => Math.round(v / GRIGLIA) * GRIGLIA;

// Punto dell'antenna dentro la stanza: quello salvato o, in mancanza, l'angolo in alto a destra.
const puntoAntenna = (s: Stanza) => ({
  x: s.x + Math.min(Math.max(s.ax ?? s.w - 22, 14), s.w - 14),
  y: s.y + Math.min(Math.max(s.ay ?? 22, 14), s.h - 14),
});

function togliAntenna(s: Stanza) {
  s.antenna = null;
  delete s.ax;
  delete s.ay;
}

type Trascina =
  | { azione: 'sposta' | 'ridimensiona'; i: number; inizio: { x: number; y: number }; orig: Stanza }
  | { azione: 'antenna'; porta: number; punto: { x: number; y: number } };

function Gettone({ porta, x, y, attiva }: { porta: number; x: number; y: number; attiva: boolean }) {
  const c = colore(porta);
  return (
    <g data-azione="antenna" data-porta={porta} style={{ cursor: 'grab' }}>
      <title>{`Antenna porta ${porta + 1}${attiva ? '' : ' (non attiva)'}`}</title>
      <circle cx={x} cy={y} r={13} fill={attiva ? c : '#fff'} stroke={c} strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}
        fill={attiva ? '#fff' : c} pointerEvents="none">{porta + 1}</text>
    </g>
  );
}

export function Piantina({ stanze, antenne, perAntenna, nonRilevati, puoModificare, onSalva }: Props) {
  const [bozza, setBozza] = useState<Stanza[] | null>(null);
  const [scelta, setScelta] = useState<number | null>(null);
  const [drag, setDrag] = useState<Trascina | null>(null);
  const [esito, setEsito] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Trascina | null>(null);
  const bozzaRef = useRef<Stanza[] | null>(null);
  dragRef.current = drag;
  bozzaRef.current = bozza;

  const modifica = bozza !== null;
  const antenna = (porta: number) => antenne.find((a) => a.antenna === porta);
  const attiva = (porta: number | null) => porta !== null && antenna(porta)?.attiva === true;
  const porte = useMemo(() => antenne.map((a) => a.antenna).sort((a, b) => a - b), [antenne]);

  function punto(ev: { clientX: number; clientY: number }) {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = ev.clientX;
    p.y = ev.clientY;
    return p.matrixTransform(svg.getScreenCTM()!.inverse());
  }

  // Trascinamento: si ascolta sulla finestra, così non si perde il gesto uscendo dal disegno.
  useEffect(() => {
    if (!drag) return;
    function muovi(ev: PointerEvent) {
      const t = dragRef.current;
      const b = bozzaRef.current;
      if (!t || !b || !svgRef.current) return;
      const p = punto(ev);
      if (t.azione === 'antenna') { setDrag({ ...t, punto: p }); return; }
      const dx = p.x - t.inizio.x, dy = p.y - t.inizio.y;
      setBozza(b.map((s, k) => {
        if (k !== t.i) return s;
        return t.azione === 'sposta'
          ? { ...s, x: Math.max(0, aGriglia(t.orig.x + dx)), y: Math.max(0, aGriglia(t.orig.y + dy)) }
          : { ...s, w: Math.max(20, aGriglia(t.orig.w + dx)), h: Math.max(20, aGriglia(t.orig.h + dy)) };
      }));
    }
    function rilascia() {
      const t = dragRef.current;
      const b = bozzaRef.current;
      setDrag(null);
      if (!t || !b || t.azione !== 'antenna') return;
      const nuova = b.map((s) => ({ ...s }));
      nuova.forEach((s) => { if (s.antenna === t.porta) togliAntenna(s); });
      // la stanza disegnata per ultima sta sopra le altre
      let dentro = -1;
      nuova.forEach((s, k) => {
        if (t.punto.x >= s.x && t.punto.x <= s.x + s.w && t.punto.y >= s.y && t.punto.y <= s.y + s.h) dentro = k;
      });
      if (dentro >= 0) {
        const s = nuova[dentro];
        s.antenna = t.porta;
        s.ax = Math.round(t.punto.x - s.x);
        s.ay = Math.round(t.punto.y - s.y);
        setScelta(dentro);
      }
      setBozza(nuova);
    }
    window.addEventListener('pointermove', muovi);
    window.addEventListener('pointerup', rilascia);
    return () => {
      window.removeEventListener('pointermove', muovi);
      window.removeEventListener('pointerup', rilascia);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  function inizia() {
    setBozza(stanze.map((s) => ({ ...s })));
    setScelta(null);
    setEsito(null);
  }

  function annulla() {
    setBozza(null);
    setScelta(null);
    setDrag(null);
    setEsito(null);
  }

  async function salva() {
    if (!bozza) return;
    setSalvando(true);
    const errore = await onSalva(bozza);
    setSalvando(false);
    if (errore) { setEsito(errore); return; }
    annulla();
  }

  function aggiungi(nome: string, w: number, h: number, corridoio: boolean) {
    if (!bozza) return;
    const fondo = Math.max(0, ...bozza.map((s) => s.y + s.h));
    const nuova: Stanza = { nome, x: 0, y: bozza.length ? fondo + 20 : 0, w, h, antenna: null, ...(corridoio ? { corridoio: true } : {}) };
    setBozza([...bozza, nuova]);
    setScelta(bozza.length);
  }

  function cambia(i: number, modificaStanza: (s: Stanza) => void) {
    if (!bozza) return;
    const nuova = bozza.map((s) => ({ ...s }));
    modificaStanza(nuova[i]);
    setBozza(nuova);
  }

  function scegliAntenna(i: number, valore: string) {
    const porta = valore === '' ? null : Number(valore);
    if (!bozza) return;
    const nuova = bozza.map((s) => ({ ...s }));
    nuova.forEach((s) => { if (porta !== null && s.antenna === porta) togliAntenna(s); });
    togliAntenna(nuova[i]);
    nuova[i].antenna = porta;
    setBozza(nuova);
  }

  function elimina(i: number) {
    if (!bozza || !confirm(`Eliminare "${bozza[i].nome}" dalla piantina?`)) return;
    setBozza(bozza.filter((_, k) => k !== i));
    setScelta(null);
  }

  function giu(ev: React.PointerEvent<SVGSVGElement>) {
    if (!bozza) return;
    const el = (ev.target as Element).closest('[data-azione]') as HTMLElement | SVGElement | null;
    if (!el) {
      if (scelta !== null) setScelta(null);
      return;
    }
    ev.preventDefault();
    const azione = el.getAttribute('data-azione');
    if (azione === 'antenna') {
      setDrag({ azione: 'antenna', porta: Number(el.getAttribute('data-porta')), punto: punto(ev) });
      return;
    }
    const gruppo = el.closest('[data-ed]');
    if (!gruppo) return;
    const i = Number(gruppo.getAttribute('data-ed'));
    setDrag({ azione: azione === 'ridimensiona' ? 'ridimensiona' : 'sposta', i, inizio: punto(ev), orig: { ...bozza[i] } });
    setScelta(i);
  }

  const elenco = bozza ?? stanze;
  const [aperta, setAperta] = useState<number | null>(null);

  // ----- disegno -----
  let viewBox: string;
  let vassoioY = 0;
  let liberePorte: number[] = [];
  const trascinata = drag?.azione === 'antenna' ? drag.porta : null;
  if (modifica) {
    liberePorte = porte.filter((p) => p !== trascinata && !elenco.some((s) => s.antenna === p));
    vassoioY = Math.max(0, ...elenco.map((s) => s.y + s.h)) + 40;
    const larghezza = Math.max(700, ...elenco.map((s) => s.x + s.w + 120));
    const altezza = Math.max(420, vassoioY + 70);
    viewBox = `0 0 ${larghezza} ${altezza}`;
  } else {
    const minX = Math.min(...elenco.map((s) => s.x)), minY = Math.min(...elenco.map((s) => s.y));
    const larghezza = Math.max(...elenco.map((s) => s.x + s.w)) - minX;
    const altezza = Math.max(...elenco.map((s) => s.y + s.h)) - minY;
    viewBox = `${minX - 10} ${minY - 10} ${larghezza + 20} ${altezza + 20}`;
  }

  const stanzaSel = modifica ? scelta : aperta;
  const selezionata = stanzaSel !== null ? elenco[stanzaSel] : null;
  const listaSel = selezionata && !selezionata.corridoio && selezionata.antenna !== null && attiva(selezionata.antenna)
    ? perAntenna.get(selezionata.antenna) ?? [] : [];

  return (
    <div className="p-4 sm:p-6">
      {!modifica && puoModificare && (
        <div className="mb-3 flex justify-end">
          <button onClick={inizia} className="premi rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-black/10 hover:bg-neutral-50">
            {stanze.length ? 'Modifica la piantina' : 'Disegna la piantina'}
          </button>
        </div>
      )}

      {!modifica && stanze.length === 0 && (
        <p className="rounded-xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
          Non c&apos;è ancora una piantina. {puoModificare
            ? 'Premi «Disegna la piantina», oppure collega l’app Fascicoli RFID: la prima volta manda quella disegnata sul computer.'
            : 'Chiedi al titolare di disegnarla.'}
        </p>
      )}

      {(modifica || stanze.length > 0) && (
        <svg
          ref={svgRef} viewBox={viewBox} role="img" aria-label="Piantina dello studio"
          onPointerDown={giu}
          className={`block h-auto w-full rounded-2xl border border-neutral-200 bg-white ${modifica ? 'select-none' : ''}`}
          style={modifica ? { touchAction: 'none' } : undefined}
        >
          {modifica && (
            <>
              <defs>
                <pattern id="griglia-rfid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M20 0H0V20" fill="none" stroke="#e5e7eb" strokeWidth="0.6" />
                </pattern>
              </defs>
              <rect x={0} y={0} width="100%" height="100%" fill="url(#griglia-rfid)" />
            </>
          )}

          {elenco.map((s, i) => {
            const c = colore(s.antenna);
            const coperta = attiva(s.antenna);
            const sel = stanzaSel === i;
            const rettangolo = (
              <rect
                x={s.x} y={s.y} width={s.w} height={s.h} rx={6}
                data-azione={modifica ? 'sposta' : undefined}
                fill={s.corridoio ? 'none' : coperta || modifica && s.antenna !== null ? `${c}1f` : '#f9fafb'}
                stroke={sel ? c : s.antenna !== null ? `${c}99` : '#d1d5db'}
                strokeWidth={sel ? 3 : 1.5}
                strokeDasharray={s.corridoio ? '5 5' : undefined}
                style={{ cursor: modifica ? 'move' : s.corridoio ? 'default' : 'pointer' }}
              />
            );
            if (s.corridoio) {
              return (
                <g key={i} data-ed={i}>
                  {rettangolo}
                  {modifica && sel && <rect data-azione="ridimensiona" x={s.x + s.w - 14} y={s.y + s.h - 14} width={14} height={14} rx={2} fill="#2563eb" style={{ cursor: 'nwse-resize' }} />}
                </g>
              );
            }
            const lista = coperta && s.antenna !== null ? perAntenna.get(s.antenna) ?? [] : [];
            const info = s.antenna === null ? 'nessuna antenna'
              : modifica ? `antenna porta ${s.antenna + 1}`
              : !coperta ? `antenna ${s.antenna + 1} non attiva`
              : lista.length === 1 ? '1 fascicolo' : `${lista.length} fascicoli`;
            const righe = Math.max(0, Math.floor((s.h - 52) / 15));
            const mostrati = lista.length > righe ? lista.slice(0, Math.max(0, righe - 1)) : lista;
            const caratteri = Math.max(6, Math.floor(s.w / 7) - 2);
            return (
              <g key={i} data-ed={i} onClick={() => { if (!modifica) setAperta(aperta === i ? null : i); }}>
                {rettangolo}
                <text x={s.x + 10} y={s.y + 20} fontSize={13.5} fontWeight={650} fill="#171717" pointerEvents="none">{s.nome}</text>
                <text x={s.x + 10} y={s.y + 36} fontSize={11} fill="#737373" pointerEvents="none">{info}</text>
                {!modifica && mostrati.map((f, j) => (
                  <text key={f.epc} x={s.x + 10} y={s.y + 56 + j * 15} fontSize={12} fill={f.uscito ? '#dc2626' : c} pointerEvents="none">
                    {f.titolo.length > caratteri ? `${f.titolo.slice(0, caratteri - 1)}…` : f.titolo}
                  </text>
                ))}
                {!modifica && righe > 0 && mostrati.length < lista.length && (
                  <text x={s.x + 10} y={s.y + 56 + mostrati.length * 15} fontSize={11} fill="#737373" pointerEvents="none">
                    + altri {lista.length - mostrati.length}
                  </text>
                )}
                {modifica && sel && <rect data-azione="ridimensiona" x={s.x + s.w - 14} y={s.y + s.h - 14} width={14} height={14} rx={2} fill="#2563eb" style={{ cursor: 'nwse-resize' }} />}
              </g>
            );
          })}

          {modifica && (
            <text x={10} y={vassoioY + 8} fontSize={11} fill="#737373">
              {liberePorte.length || trascinata !== null
                ? 'Antenne da sistemare: trascinale nella stanza, nel punto in cui si trovano'
                : 'Tutte le antenne sono nella piantina'}
            </text>
          )}

          {elenco.filter((s) => s.antenna !== null && s.antenna !== trascinata).map((s) => {
            const p = puntoAntenna(s);
            return <Gettone key={`a${s.antenna}`} porta={s.antenna!} x={p.x} y={p.y} attiva={attiva(s.antenna)} />;
          })}
          {modifica && liberePorte.map((p, k) => (
            <Gettone key={`l${p}`} porta={p} x={24 + k * 36} y={vassoioY + 34} attiva={attiva(p)} />
          ))}
          {modifica && drag?.azione === 'antenna' && (
            <Gettone porta={drag.porta} x={drag.punto.x} y={drag.punto.y} attiva={attiva(drag.porta)} />
          )}
        </svg>
      )}

      {modifica && bozza && (
        <div className="mt-4 space-y-3 rounded-2xl bg-neutral-50 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => aggiungi('Nuova stanza', 160, 110, false)} className="premi rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/10">+ Stanza</button>
            <button onClick={() => aggiungi('Corridoio', 30, 200, true)} className="premi rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/10">+ Corridoio</button>
            <span className="flex-1" />
            <button onClick={annulla} className="premi rounded-full bg-white px-4 py-1.5 text-xs text-neutral-600 ring-1 ring-black/10">Annulla</button>
            <button onClick={salva} disabled={salvando} className="premi rounded-full bg-bordeaux-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
              {salvando ? 'Salvo…' : 'Salva piantina'}
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Trascina una stanza per spostarla; trascina il quadratino blu in basso a destra per cambiarne la misura.
            Trascina i cerchi numerati (le antenne, una per porta del lettore) nella stanza e nel punto in cui si trovano davvero;
            portali fuori dalle stanze per toglierli.
          </p>
          {scelta !== null && bozza[scelta] ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-600">
                Nome della stanza
                <input
                  value={bozza[scelta].nome} maxLength={40}
                  onChange={(e) => cambia(scelta, (s) => { s.nome = e.target.value; })}
                  className="mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-normal text-neutral-900 outline-none focus:border-bordeaux-400"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-600">
                Antenna in questa stanza
                <select
                  value={bozza[scelta].antenna ?? ''} onChange={(e) => scegliAntenna(scelta, e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-normal text-neutral-900 outline-none focus:border-bordeaux-400"
                >
                  <option value="">Nessuna antenna</option>
                  {antenne.map((a) => (
                    <option key={a.antenna} value={a.antenna}>
                      Porta {a.antenna + 1} — {a.nome}{a.attiva ? '' : ' (non attiva)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-700">
                <input
                  type="checkbox" checked={bozza[scelta].corridoio === true}
                  onChange={(e) => cambia(scelta, (s) => { if (e.target.checked) s.corridoio = true; else delete s.corridoio; })}
                />
                È un corridoio (tratteggiato, senza scritte)
              </label>
              <div className="text-right">
                <button onClick={() => elimina(scelta)} className="premi rounded-full px-3 py-1.5 text-xs text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                  Elimina questa stanza
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Tocca una stanza per cambiarle nome o antenna.</p>
          )}
          {esito && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{esito}</p>}
        </div>
      )}

      {!modifica && stanze.length > 0 && (
        <div className="mt-4 text-sm">
          {selezionata && !selezionata.corridoio ? (
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="mb-2 font-semibold text-neutral-900">
                {selezionata.nome} <span className="font-normal text-neutral-400">{listaSel.length}</span>
              </p>
              {listaSel.length ? (
                <ul className="divide-y divide-neutral-200">
                  {listaSel.map((f) => (
                    <li key={f.epc} className={`flex flex-wrap items-center justify-between gap-2 py-1.5 ${f.perso ? 'text-neutral-400' : 'text-neutral-800'}`}>
                      <span className="font-medium">{f.titolo}{f.uscito && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">uscito?</span>}</span>
                      <span className="text-xs text-neutral-400">{f.visto}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-neutral-500">
                  {selezionata.antenna === null
                    ? "In questa stanza non c'è un'antenna: i fascicoli qui non vengono rilevati."
                    : !attiva(selezionata.antenna) ? "L'antenna di questa stanza non è attiva." : 'Nessun fascicolo.'}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              Tocca una stanza per vedere i suoi fascicoli.
              {nonRilevati > 0 && ` Fascicoli non rilevati da nessuna antenna: ${nonRilevati}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

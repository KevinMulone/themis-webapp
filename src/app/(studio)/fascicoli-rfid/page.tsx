'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import { clientLabel, labelFromOptions, TIPI_PRATICA } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';
import { Piantina, type Antenna, type FascicoloInStanza, type Stanza } from './Piantina';

type ClienteRef = { tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type Cliente = ClienteRef & { id: string };
type MatterRef = { id: string; tipo_pratica: string; clients: ClienteRef | ClienteRef[] | null };
type Lettore = { id: string; nome: string; token_inizio: string; created_at: string; ultimo_contatto: string | null };
type Etichetta = {
  epc: string; descrizione: string | null; matter_id: string | null; client_id: string | null;
  matters: MatterRef | MatterRef[] | null; clients: ClienteRef | ClienteRef[] | null;
};
type Posizione = { epc: string; antenna: number | null; stanza: string | null; dal: string; ultimo_visto: string };
type Movimento = { id: number; epc: string; da_stanza: string | null; a_stanza: string | null; ts: string };

// Oltre questo tempo senza segnale la stanza è solo "l'ultima nota": il
// fascicolo potrebbe essere in un punto non coperto, o uscito dallo studio.
const NON_VISTO_MS = 30 * 60 * 1000;
const LETTORE_ATTIVO_MS = 3 * 60 * 1000;
// Letto per ultimo all'antenna dell'uscita e poi sparito: forse è uscito dallo studio.
const USCITO_MS = 2 * 60 * 1000;

function primo<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function nomePratica(m: MatterRef | null): string {
  if (!m) return '';
  const cliente = clientLabel(primo(m.clients));
  const tipo = labelFromOptions(TIPI_PRATICA, m.tipo_pratica);
  return cliente ? `${cliente} — ${tipo}` : tipo;
}

function fa(iso: string | null): string {
  if (!iso) return 'mai';
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'adesso';
  if (sec < 3600) return `${Math.round(sec / 60)} min fa`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ora(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const corta = (epc: string) => `…${epc.slice(-8)}`;

const campo = 'rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-bordeaux-400';

/** Cerca il cliente scrivendone una parte del nome, e lo sceglie dall'elenco. */
function SceltaCliente({ clienti, valore, onScegli }: { clienti: Cliente[]; valore: string; onScegli: (id: string) => void }) {
  const [testo, setTesto] = useState('');
  const [aperto, setAperto] = useState(false);
  const scelto = clienti.find((c) => c.id === valore);
  const trovati = useMemo(() => {
    const q = testo.trim().toLowerCase();
    return clienti.filter((c) => !q || clientLabel(c).toLowerCase().includes(q)).slice(0, 8);
  }, [clienti, testo]);
  return (
    <div className="relative min-w-56 flex-1">
      <input
        value={aperto ? testo : scelto ? clientLabel(scelto) : ''}
        onFocus={() => { setTesto(''); setAperto(true); }}
        onBlur={() => setAperto(false)}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Cerca il cliente…"
        className={`w-full ${campo}`}
      />
      {aperto && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-black/10">
          {trovati.length === 0 && <li className="px-3 py-2 text-neutral-400">Nessun cliente trovato</li>}
          {trovati.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                // mouseDown e non click: il click arriverebbe dopo che il campo ha già perso il fuoco
                onMouseDown={(ev) => { ev.preventDefault(); onScegli(c.id); setAperto(false); }}
                className="block w-full px-3 py-2 text-left hover:bg-bordeaux-50"
              >
                {clientLabel(c)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FascicoliRfidPage() {
  const supabase = useMemo(() => createClient(), []);
  const { ruolo, studioId } = useStudio();
  const [lettori, setLettori] = useState<Lettore[]>([]);
  const [etichette, setEtichette] = useState<Etichetta[]>([]);
  const [posizioni, setPosizioni] = useState<Posizione[]>([]);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [antenne, setAntenne] = useState<Antenna[]>([]);
  const [mappa, setMappa] = useState<Stanza[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [ricerca, setRicerca] = useState('');
  const [scelte, setScelte] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [modCliente, setModCliente] = useState('');
  const [modNota, setModNota] = useState('');
  const [storicoAperto, setStoricoAperto] = useState<string | null>(null);
  const [storico, setStorico] = useState<Record<string, Movimento[]>>({});
  const [nomeLettore, setNomeLettore] = useState('');
  const [tokenNuovo, setTokenNuovo] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [, setOrologio] = useState(0);

  const load = useCallback(async () => {
    const [l, e, p, m, cl, st, mp] = await Promise.all([
      supabase.from('rfid_lettori').select('id, nome, token_inizio, created_at, ultimo_contatto')
        .is('revocato_at', null).order('created_at'),
      supabase.from('rfid_etichette')
        .select('epc, descrizione, matter_id, client_id, matters(id, tipo_pratica, clients(tipo_soggetto, nome, cognome, ragione_sociale)), clients(tipo_soggetto, nome, cognome, ragione_sociale)'),
      supabase.from('rfid_posizioni').select('epc, antenna, stanza, dal, ultimo_visto'),
      supabase.from('rfid_movimenti').select('id, epc, da_stanza, a_stanza, ts').order('ts', { ascending: false }).limit(60),
      supabase.from('clients').select('id, tipo_soggetto, nome, cognome, ragione_sociale').eq('archiviato', false).order('cognome'),
      supabase.from('rfid_stanze').select('antenna, nome, attiva, uscita').order('antenna'),
      supabase.from('rfid_mappa').select('stanze').maybeSingle(),
    ]);
    // Se il database non ha ancora la migrazione 040, la lettura delle etichette fallisce: lo si dice.
    if (e.error || mp.error) setErrore("Il database va aggiornato (migrazione 040): finché non è fatto, associazioni e piantina non si vedono.");
    else setErrore((prec) => (prec?.startsWith('Il database va aggiornato') ? null : prec));
    setLettori((l.data || []) as Lettore[]);
    setEtichette((e.data || []) as unknown as Etichetta[]);
    setPosizioni((p.data || []) as Posizione[]);
    setMovimenti((m.data || []) as Movimento[]);
    setClienti((cl.data || []) as Cliente[]);
    // Più lettori possono avere la stessa porta: conta la prima.
    const viste = new Map<number, Antenna>();
    for (const a of (st.data || []) as Antenna[]) if (!viste.has(a.antenna)) viste.set(a.antenna, a);
    setAntenne([...viste.values()]);
    setMappa(((mp.data?.stanze as Stanza[] | undefined) ?? []).map((x) => ({ ...x, antenna: x.antenna ?? null })));
    setCaricando(false);
  }, [supabase]);

  // Una sincronizzazione del Mac aggiorna decine di righe in un colpo, e
  // ognuna arriva come evento separato: si ricarica una volta sola, poco dopo.
  const attesa = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ricarica = useCallback(() => {
    if (attesa.current) clearTimeout(attesa.current);
    attesa.current = setTimeout(load, 400);
  }, [load]);

  useEffect(() => { load(); }, [load]);
  useAggiornamentoLive(['rfid_lettori', 'rfid_etichette', 'rfid_posizioni', 'rfid_movimenti', 'rfid_mappa'], ricarica);
  // "2 min fa" deve diventare "3 min fa" anche se nulla si muove.
  useEffect(() => {
    const t = setInterval(() => setOrologio((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const perEpc = useMemo(() => new Map(posizioni.map((p) => [p.epc, p])), [posizioni]);
  const etichettaDi = useMemo(() => new Map(etichette.map((e) => [e.epc, e])), [etichette]);
  // Il titolo di un fascicolo è il cliente; le associazioni più vecchie, fatte con una pratica, restano com'erano.
  const titoloDi = (e: Etichetta) =>
    clientLabel(primo(e.clients)) || nomePratica(primo(e.matters)) || e.descrizione || corta(e.epc);
  const descrizioneDi = (epc: string) => {
    const e = etichettaDi.get(epc);
    return e ? titoloDi(e) : null;
  };

  const fascicoli = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return etichette
      .map((e) => ({ e, titolo: titoloDi(e), pos: perEpc.get(e.epc) }))
      .filter(({ titolo, e, pos }) => !q || `${titolo} ${e.descrizione ?? ''} ${pos?.stanza ?? ''} ${e.epc}`.toLowerCase().includes(q))
      .sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etichette, perEpc, ricerca]);

  const daAssociare = posizioni
    .filter((p) => !etichettaDi.has(p.epc))
    .sort((a, b) => b.ultimo_visto.localeCompare(a.ultimo_visto));

  const lettoriAttivi = lettori.filter((l) => l.ultimo_contatto && Date.now() - new Date(l.ultimo_contatto).getTime() < LETTORE_ATTIVO_MS);

  async function associa(epc: string) {
    const clientId = scelte[epc];
    if (!clientId) return;
    setErrore(null);
    const { error } = await supabase.from('rfid_etichette')
      .insert({ studio_id: studioId, epc, client_id: clientId, descrizione: note[epc]?.trim() || null });
    if (error) setErrore('Etichetta non associata: riprova.');
    else load();
  }

  function iniziaModifica(e: Etichetta) {
    setInModifica(e.epc);
    setModCliente(e.client_id ?? '');
    setModNota(e.descrizione ?? '');
  }

  async function salvaModifica(epc: string) {
    if (!modCliente) return;
    setErrore(null);
    const { error } = await supabase.from('rfid_etichette')
      .update({ client_id: modCliente, matter_id: null, descrizione: modNota.trim() || null }).eq('epc', epc);
    if (error) { setErrore('Modifica non salvata: riprova.'); return; }
    setInModifica(null);
    load();
  }

  async function apriStorico(epc: string) {
    if (storicoAperto === epc) { setStoricoAperto(null); return; }
    setStoricoAperto(epc);
    const { data } = await supabase.from('rfid_movimenti').select('id, epc, da_stanza, a_stanza, ts')
      .eq('epc', epc).order('ts', { ascending: false }).limit(15);
    setStorico((prec) => ({ ...prec, [epc]: (data || []) as Movimento[] }));
  }

  async function salvaMappa(stanze: Stanza[]): Promise<string | null> {
    const { error } = await supabase.from('rfid_mappa')
      .upsert({ studio_id: studioId, stanze, aggiornata_at: new Date().toISOString() }, { onConflict: 'studio_id' });
    if (error) return 'Piantina non salvata: riprova.';
    load();
    return null;
  }

  async function scollega(epc: string) {
    if (!confirm("Togliere l'associazione tra questa etichetta e il cliente?")) return;
    const { error } = await supabase.from('rfid_etichette').delete().eq('epc', epc);
    if (error) setErrore('Associazione non rimossa: riprova.');
    else load();
  }

  async function nuovoLettore() {
    setErrore(null);
    const r = await fetch('/api/rfid/lettori', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nomeLettore }),
    });
    const dati = await r.json().catch(() => ({}));
    if (!r.ok) { setErrore(dati.error || 'Lettore non creato'); return; }
    setTokenNuovo(dati.token);
    setNomeLettore('');
    load();
  }

  async function revoca(id: string) {
    if (!confirm('Scollegare questo lettore? Il Mac smetterà subito di aggiornare Themis.')) return;
    const r = await fetch(`/api/rfid/lettori/${id}`, { method: 'DELETE' });
    if (!r.ok) setErrore('Lettore non scollegato: riprova.');
    else load();
  }

  // I fascicoli associati, raggruppati per antenna, per la piantina.
  const antenneDi = new Map(antenne.map((a) => [a.antenna, a]));
  const perAntenna = new Map<number, FascicoloInStanza[]>();
  for (const p of posizioni) {
    const e = etichettaDi.get(p.epc);
    if (!e || p.antenna === null) continue;
    const sec = Date.now() - new Date(p.ultimo_visto).getTime();
    const elenco = perAntenna.get(p.antenna) ?? [];
    elenco.push({
      epc: p.epc, titolo: titoloDi(e), visto: `visto ${fa(p.ultimo_visto)}`,
      perso: sec > NON_VISTO_MS, uscito: antenneDi.get(p.antenna)?.uscita === true && sec > USCITO_MS,
    });
    perAntenna.set(p.antenna, elenco);
  }
  const nonRilevati = fascicoli.filter(({ pos }) => !pos || pos.antenna === null || !mappa.some((m) => m.antenna === pos.antenna)).length;

  const scheda = 'module-panel overflow-hidden rounded-[26px] bg-white/90 ring-1 ring-black/[0.04]';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="module-eyebrow">Archivio fisico</p>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-neutral-900">Fascicoli RFID</h1>
          <p className="mt-1 text-sm text-neutral-500">
            In quale stanza dello studio si trova il fascicolo di carta, letto dalle antenne.
          </p>
        </div>
        <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
          lettoriAttivi.length ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
        }`}>
          <span className={`h-2 w-2 rounded-full ${lettoriAttivi.length ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
          {lettoriAttivi.length ? 'Lettore collegato' : lettori.length ? 'Lettore non raggiungibile' : 'Nessun lettore'}
        </span>
      </div>

      {errore && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errore}</p>}

      <div className="module-toolbar mb-4 flex flex-wrap gap-2 rounded-2xl bg-white/90 p-3 ring-1 ring-black/[0.04]">
        <input
          value={ricerca} onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca cliente o stanza…"
          className="min-w-56 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-bordeaux-400"
        />
      </div>

      <section className={`${scheda} mb-6`}>
        <h2 className="border-b border-neutral-100 px-6 py-4 text-sm font-semibold text-neutral-900">Piantina dello studio</h2>
        <Piantina
          stanze={mappa} antenne={antenne} perAntenna={perAntenna} nonRilevati={nonRilevati}
          puoModificare onSalva={salvaMappa}
        />
      </section>

      <section className={`${scheda} mb-6`}>
        <h2 className="border-b border-neutral-100 px-6 py-4 text-sm font-semibold text-neutral-900">Dove si trova</h2>
        {caricando ? (
          <p className="p-6 text-sm text-neutral-500">Caricamento...</p>
        ) : fascicoli.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bordeaux-50 text-bordeaux-300">
              <Icon nome="documento" className="h-8 w-8" />
            </span>
            <p className="mx-auto max-w-sm text-sm text-neutral-500">
              {etichette.length
                ? 'Nessun fascicolo corrisponde alla ricerca.'
                : "Nessuna etichetta associata. Avvicina un fascicolo etichettato a un'antenna: comparirà qui sotto, pronto da associare al suo cliente."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {fascicoli.map(({ e, titolo, pos }) => {
              const perso = !pos || Date.now() - new Date(pos.ultimo_visto).getTime() > NON_VISTO_MS;
              const storicoEpc = storico[e.epc];
              return (
                <li key={e.epc} className="px-6 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {e.matter_id && !e.client_id ? (
                        <Link href={`/pratiche/${e.matter_id}`} className="font-medium text-neutral-900 hover:text-bordeaux-700">{titolo}</Link>
                      ) : (
                        <span className="font-medium text-neutral-900">{titolo}</span>
                      )}
                      <p className="text-xs text-neutral-400">
                        {e.descrizione && e.client_id ? `${e.descrizione} · ` : ''}Etichetta {corta(e.epc)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${perso ? 'text-neutral-400' : 'text-bordeaux-700'}`}>
                        {pos?.stanza ?? 'Mai letto'}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {pos ? `${perso ? 'ultimo segnale' : 'visto'} ${fa(pos.ultimo_visto)} · qui da ${fa(pos.dal)}` : 'nessun segnale'}
                      </p>
                    </div>
                    <button onClick={() => apriStorico(e.epc)} className="premi rounded-full px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100">
                      Storico
                    </button>
                    <button onClick={() => (inModifica === e.epc ? setInModifica(null) : iniziaModifica(e))} className="premi rounded-full px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100">
                      Modifica
                    </button>
                    <button
                      onClick={() => scollega(e.epc)} title="Togli l'associazione"
                      className="premi rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>

                  {inModifica === e.epc && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                      <SceltaCliente clienti={clienti} valore={modCliente} onScegli={setModCliente} />
                      <input
                        value={modNota} onChange={(ev) => setModNota(ev.target.value)} maxLength={120}
                        placeholder="Descrizione (facoltativa)" className={`min-w-48 flex-1 ${campo}`}
                      />
                      <button
                        onClick={() => salvaModifica(e.epc)} disabled={!modCliente}
                        className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-40"
                      >
                        Salva
                      </button>
                    </div>
                  )}

                  {storicoAperto === e.epc && (
                    <div className="mt-3 rounded-2xl bg-neutral-50 p-3 text-xs">
                      {!storicoEpc ? (
                        <p className="text-neutral-400">Caricamento…</p>
                      ) : storicoEpc.length === 0 ? (
                        <p className="text-neutral-500">Nessuno spostamento registrato per questo fascicolo.</p>
                      ) : (
                        <ul className="space-y-1">
                          {storicoEpc.map((m) => (
                            <li key={m.id} className="flex flex-wrap gap-3">
                              <span className="w-32 shrink-0 tabular-nums text-neutral-400">{ora(m.ts)}</span>
                              <span className="text-neutral-600">
                                {m.da_stanza ? <>{m.da_stanza} → </> : 'compare in '}
                                <span className="font-semibold text-neutral-800">{m.a_stanza}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {daAssociare.length > 0 && (
        <section className={`${scheda} mb-6`}>
          <h2 className="border-b border-neutral-100 px-6 py-4 text-sm font-semibold text-neutral-900">
            Etichette da associare <span className="font-normal text-neutral-400">({daAssociare.length})</span>
          </h2>
          <ul className="divide-y divide-neutral-100 text-sm">
            {daAssociare.map((p) => (
              <li key={p.epc} className="flex flex-wrap items-center gap-3 px-6 py-3">
                <div className="min-w-40 flex-1">
                  <p className="font-mono text-xs text-neutral-700">{p.epc}</p>
                  <p className="text-xs text-neutral-400">{p.stanza ?? '—'} · {fa(p.ultimo_visto)}</p>
                </div>
                <SceltaCliente clienti={clienti} valore={scelte[p.epc] ?? ''} onScegli={(id) => setScelte({ ...scelte, [p.epc]: id })} />
                <input
                  value={note[p.epc] ?? ''} onChange={(e) => setNote({ ...note, [p.epc]: e.target.value })} maxLength={120}
                  placeholder="Descrizione (facoltativa)" className={`min-w-48 flex-1 ${campo}`}
                />
                <button
                  onClick={() => associa(p.epc)} disabled={!scelte[p.epc]}
                  className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-40"
                >
                  Associa
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${scheda} mb-6`}>
        <h2 className="border-b border-neutral-100 px-6 py-4 text-sm font-semibold text-neutral-900">Ultimi spostamenti</h2>
        {movimenti.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">Nessuno spostamento registrato.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {movimenti.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-6 py-2.5">
                <span className="w-32 shrink-0 text-xs tabular-nums text-neutral-400">{ora(m.ts)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
                  {descrizioneDi(m.epc) ?? <span className="font-normal text-neutral-400">Etichetta {corta(m.epc)}</span>}
                </span>
                <span className="text-neutral-500">
                  {m.da_stanza ? <>{m.da_stanza} → </> : 'compare in '}
                  <span className="font-semibold text-neutral-800">{m.a_stanza}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={scheda}>
        <h2 className="border-b border-neutral-100 px-6 py-4 text-sm font-semibold text-neutral-900">Lettori</h2>
        <div className="space-y-4 p-6 text-sm">
          {lettori.length === 0 && (
            <p className="text-neutral-500">
              Nessun lettore collegato. Il lettore resta collegato al Mac dello studio con il cavo USB: l&apos;app
              &quot;Fascicoli RFID&quot; del Mac manda qui le posizioni usando il codice che crei qui sotto.
            </p>
          )}
          {lettori.map((l) => {
            const attivo = lettoriAttivi.includes(l);
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${attivo ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                <span className="flex-1 font-medium text-neutral-800">
                  {l.nome} <span className="font-mono text-xs font-normal text-neutral-400">{l.token_inizio}…</span>
                </span>
                <span className="text-xs text-neutral-400">ultimo contatto {fa(l.ultimo_contatto)}</span>
                {ruolo === 'titolare' && (
                  <button onClick={() => revoca(l.id)} className="premi rounded-full px-3 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700">
                    Scollega
                  </button>
                )}
              </div>
            );
          })}

          {tokenNuovo && (
            <div className="rounded-2xl bg-gold-50 p-4">
              <p className="font-semibold text-neutral-900">Codice del lettore — copialo adesso, non verrà più mostrato</p>
              <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-neutral-800 ring-1 ring-black/5">{tokenNuovo}</code>
              <p className="mt-2 text-xs text-neutral-600">
                Sul Mac apri l&apos;app Fascicoli RFID → Impostazioni → Collegamento a Themis e incollalo.
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(tokenNuovo)} className="premi rounded-full bg-bordeaux-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-bordeaux-800">
                  Copia
                </button>
                <button onClick={() => setTokenNuovo(null)} className="premi rounded-full bg-white px-4 py-1.5 text-xs text-neutral-600 ring-1 ring-black/10">
                  Fatto
                </button>
              </div>
            </div>
          )}

          {ruolo === 'titolare' && !tokenNuovo && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
              <input
                value={nomeLettore} onChange={(e) => setNomeLettore(e.target.value)}
                placeholder="Nome del lettore (es. Lettore segreteria)"
                className="min-w-56 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-bordeaux-400"
              />
              <button onClick={nuovoLettore} className="shine-button premi rounded-full bg-bordeaux-700 px-5 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
                + Collega un lettore
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

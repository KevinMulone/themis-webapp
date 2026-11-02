'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import { clientLabel, labelFromOptions, TIPI_PRATICA } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';

type ClienteRef = { tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type MatterRef = { id: string; tipo_pratica: string; clients: ClienteRef | ClienteRef[] | null };
type Lettore = { id: string; nome: string; token_inizio: string; created_at: string; ultimo_contatto: string | null };
type Etichetta = { epc: string; descrizione: string | null; matter_id: string | null; matters: MatterRef | MatterRef[] | null };
type Posizione = { epc: string; stanza: string | null; dal: string; ultimo_visto: string };
type Movimento = { id: number; epc: string; da_stanza: string | null; a_stanza: string | null; ts: string };

// Oltre questo tempo senza segnale la stanza è solo "l'ultima nota": il
// fascicolo potrebbe essere in un punto non coperto, o uscito dallo studio.
const NON_VISTO_MS = 30 * 60 * 1000;
const LETTORE_ATTIVO_MS = 3 * 60 * 1000;

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

export default function FascicoliRfidPage() {
  const supabase = useMemo(() => createClient(), []);
  const { ruolo, studioId } = useStudio();
  const [lettori, setLettori] = useState<Lettore[]>([]);
  const [etichette, setEtichette] = useState<Etichetta[]>([]);
  const [posizioni, setPosizioni] = useState<Posizione[]>([]);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [pratiche, setPratiche] = useState<MatterRef[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [ricerca, setRicerca] = useState('');
  const [scelte, setScelte] = useState<Record<string, string>>({});
  const [nomeLettore, setNomeLettore] = useState('');
  const [tokenNuovo, setTokenNuovo] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [, setOrologio] = useState(0);

  const load = useCallback(async () => {
    const [l, e, p, m, pr] = await Promise.all([
      supabase.from('rfid_lettori').select('id, nome, token_inizio, created_at, ultimo_contatto')
        .is('revocato_at', null).order('created_at'),
      supabase.from('rfid_etichette')
        .select('epc, descrizione, matter_id, matters(id, tipo_pratica, clients(tipo_soggetto, nome, cognome, ragione_sociale))'),
      supabase.from('rfid_posizioni').select('epc, stanza, dal, ultimo_visto'),
      supabase.from('rfid_movimenti').select('id, epc, da_stanza, a_stanza, ts').order('ts', { ascending: false }).limit(60),
      supabase.from('matters').select('id, tipo_pratica, clients(tipo_soggetto, nome, cognome, ragione_sociale)')
        .neq('stato', 'archiviata').order('created_at', { ascending: false }),
    ]);
    setLettori((l.data || []) as Lettore[]);
    setEtichette((e.data || []) as unknown as Etichetta[]);
    setPosizioni((p.data || []) as Posizione[]);
    setMovimenti((m.data || []) as Movimento[]);
    setPratiche((pr.data || []) as unknown as MatterRef[]);
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
  useAggiornamentoLive(['rfid_lettori', 'rfid_etichette', 'rfid_posizioni', 'rfid_movimenti'], ricarica);
  // "2 min fa" deve diventare "3 min fa" anche se nulla si muove.
  useEffect(() => {
    const t = setInterval(() => setOrologio((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const perEpc = useMemo(() => new Map(posizioni.map((p) => [p.epc, p])), [posizioni]);
  const etichettaDi = useMemo(() => new Map(etichette.map((e) => [e.epc, e])), [etichette]);
  const descrizioneDi = (epc: string) => {
    const e = etichettaDi.get(epc);
    if (!e) return null;
    return nomePratica(primo(e.matters)) || e.descrizione || corta(epc);
  };

  const fascicoli = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return etichette
      .map((e) => ({ e, titolo: nomePratica(primo(e.matters)) || e.descrizione || corta(e.epc), pos: perEpc.get(e.epc) }))
      .filter(({ titolo, e, pos }) => !q || `${titolo} ${e.descrizione ?? ''} ${pos?.stanza ?? ''} ${e.epc}`.toLowerCase().includes(q))
      .sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));
  }, [etichette, perEpc, ricerca]);

  const daAssociare = posizioni
    .filter((p) => !etichettaDi.has(p.epc))
    .sort((a, b) => b.ultimo_visto.localeCompare(a.ultimo_visto));

  const lettoriAttivi = lettori.filter((l) => l.ultimo_contatto && Date.now() - new Date(l.ultimo_contatto).getTime() < LETTORE_ATTIVO_MS);

  async function associa(epc: string) {
    const matterId = scelte[epc];
    if (!matterId) return;
    setErrore(null);
    const { error } = await supabase.from('rfid_etichette').insert({ studio_id: studioId, epc, matter_id: matterId });
    if (error) setErrore('Etichetta non associata: riprova.');
    else load();
  }

  async function scollega(epc: string) {
    if (!confirm("Togliere l'associazione tra questa etichetta e la pratica?")) return;
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

  const scheda = 'module-panel overflow-hidden rounded-[26px] bg-white/90 ring-1 ring-black/[0.04]';

  return (
    <div className="mx-auto max-w-4xl">
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
          placeholder="Cerca cliente, pratica o stanza…"
          className="min-w-56 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-bordeaux-400"
        />
      </div>

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
                : "Nessuna etichetta associata. Avvicina un fascicolo etichettato a un'antenna: comparirà qui sotto, pronto da associare alla sua pratica."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {fascicoli.map(({ e, titolo, pos }) => {
              const perso = !pos || Date.now() - new Date(pos.ultimo_visto).getTime() > NON_VISTO_MS;
              return (
                <li key={e.epc} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    {e.matter_id ? (
                      <Link href={`/pratiche/${e.matter_id}`} className="font-medium text-neutral-900 hover:text-bordeaux-700">{titolo}</Link>
                    ) : (
                      <span className="font-medium text-neutral-900">{titolo}</span>
                    )}
                    <p className="text-xs text-neutral-400">Etichetta {corta(e.epc)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${perso ? 'text-neutral-400' : 'text-bordeaux-700'}`}>
                      {pos?.stanza ?? 'Mai letto'}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {pos ? `${perso ? 'ultimo segnale' : 'visto'} ${fa(pos.ultimo_visto)} · qui da ${fa(pos.dal)}` : 'nessun segnale'}
                    </p>
                  </div>
                  <button
                    onClick={() => scollega(e.epc)} title="Togli l'associazione"
                    className="premi rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                  >
                    ×
                  </button>
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
                <select
                  value={scelte[p.epc] ?? ''} onChange={(e) => setScelte({ ...scelte, [p.epc]: e.target.value })}
                  className="min-w-56 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-bordeaux-400"
                >
                  <option value="">Scegli la pratica…</option>
                  {pratiche.map((m) => <option key={m.id} value={m.id}>{nomePratica(m)}</option>)}
                </select>
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

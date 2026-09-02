'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { TIPI_PRATICA, STATI_PRATICA, labelFromOptions, clientLabel, formatDateIt } from '@/lib/constants';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

type Client = { id: string; tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type Matter = {
  id: string; client_id: string; tipo_pratica: string; stato: string; updated_at: string;
  assegnato_a: string | null;
  numero_riferimento: string | null;
  controparte_nome: string | null;
  compagnia_assicurativa: string | null;
  tribunale: string | null;
  rg_numero: string | null;
  rg_anno: string | null;
  clients?: Client;
};

type ColonnaOrdinabile = 'cliente' | 'tipo' | 'stato' | 'aggiornata' | 'assegnata';

/**
 * Le tre famiglie di stato.
 *
 * Gli stati nel database sono sette, ma per contarli a colpo d'occhio ne
 * servono tre: quelle su cui stai lavorando, quelle ferme, quelle finite.
 * Le tre "chiuse" (vinta, persa, transatta) restano distinte dentro la
 * pratica, dove la differenza conta davvero.
 */
function famigliaStato(stato: string): 'aperta' | 'attesa' | 'chiusa' {
  if (stato.startsWith('chiusa')) return 'chiusa';
  if (stato === 'sospesa') return 'attesa';
  return 'aperta';
}

const STILE_STATO: Record<string, { punto: string; sfondo: string }> = {
  aperta: { punto: 'bg-green-500', sfondo: 'bg-green-100 text-green-700' },
  attesa: { punto: 'bg-amber-500', sfondo: 'bg-amber-100 text-amber-700' },
  chiusa: { punto: 'bg-neutral-400', sfondo: 'bg-neutral-100 text-neutral-600' },
};

function inizialiCliente(c: Client | undefined): string {
  const base = clientLabel(c).trim();
  const parti = base.split(/\s+/).filter(Boolean);
  if (parti.length >= 2) return (parti[0][0] + parti[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase() || '—';
}

/**
 * Il riferimento con cui riconosci la pratica in un elenco.
 *
 * Si preferisce il numero di ruolo quando c'è — è quello che usi parlando
 * con la cancelleria — altrimenti il riferimento interno. Non si inventa
 * una numerazione automatica che il database non ha.
 */
function riferimento(m: Matter): string | null {
  if (m.rg_numero) return `R.G. ${m.rg_numero}${m.rg_anno ? `/${m.rg_anno}` : ''}`;
  if (m.numero_riferimento) return `N. ${m.numero_riferimento}`;
  return null;
}

function TesseraConteggio({ icona, tinta, valore, etichetta }: {
  icona: NomeIcona; tinta: string; valore: number; etichetta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tinta}`}>
        <Icon nome={icona} className="h-5 w-5" />
      </span>
      <div>
        <div className="text-xl font-bold text-neutral-900">{valore}</div>
        <div className="text-sm font-medium text-neutral-700">{etichetta}</div>
        <div className="text-xs text-neutral-400">Pratiche</div>
      </div>
    </div>
  );
}

function Colonna({ campo, etichetta, ordine, onClick }: {
  campo: ColonnaOrdinabile; etichetta: string;
  ordine: { campo: ColonnaOrdinabile; verso: 'asc' | 'desc' };
  onClick: (c: ColonnaOrdinabile) => void;
}) {
  const attiva = ordine.campo === campo;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onClick(campo)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          attiva ? 'text-bordeaux-700' : 'text-neutral-500 hover:text-neutral-700'
        }`}
      >
        {etichetta}
        <span className="text-[9px] leading-none">
          {attiva ? (ordine.verso === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </button>
    </th>
  );
}

export default function PraticheePage() {
  const supabase = createClient();
  const router = useRouter();
  const { studioId } = useStudio();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newTipo, setNewTipo] = useState('sinistro');
  const [membri, setMembri] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [mostraFiltri, setMostraFiltri] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [ordine, setOrdine] = useState<{ campo: ColonnaOrdinabile; verso: 'asc' | 'desc' }>({
    campo: 'aggiornata', verso: 'desc',
  });
  const [pagina, setPagina] = useState(1);
  const [perPagina, setPerPagina] = useState(10);

  async function load() {
    setLoading(true);
    const [{ data }, { data: clientsData }, { data: membriData }] = await Promise.all([
      supabase.from('matters')
        .select('*, clients(id, tipo_soggetto, nome, cognome, ragione_sociale)')
        .neq('stato', 'archiviata')
        .order('updated_at', { ascending: false }),
      supabase.from('clients').select('id, tipo_soggetto, nome, cognome, ragione_sociale')
        .eq('archiviato', false).order('cognome'),
      supabase.from('studio_membri').select('user_id, nome, email'),
    ]);
    setMatters((data as Matter[]) || []);
    setClients(clientsData || []);
    // Il nome si risolve qui e non con una join: studio_membri non ha una
    // chiave esterna verso matters che PostgREST possa seguire.
    const rosa: Record<string, string> = {};
    for (const m of membriData || []) {
      if (m.user_id) rosa[m.user_id] = m.nome || m.email || 'collaboratore';
    }
    setMembri(rosa);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  // Cambiando ricerca o filtri si torna alla prima pagina: restare su
  // pagina 4 quando i risultati sono diventati tre significa guardare una
  // tabella vuota e credere che non ci sia nulla.
  useEffect(() => { setPagina(1); }, [search, filtroTipo, filtroStato, perPagina]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientId) { alert('Seleziona un cliente'); return; }
    const { data, error } = await supabase.from('matters').insert({
      studio_id: studioId, client_id: newClientId, tipo_pratica: newTipo, stato: 'aperta',
    }).select('id').single();
    if (error) { alert(error.message); return; }
    if (newTipo === 'sinistro' && data) {
      await supabase.from('sinistri').insert({ studio_id: studioId, matter_id: data.id });
    }
    setCreating(false);
    load();
  }

  function nomeAssegnata(m: Matter): string | null {
    if (!m.assegnato_a) return null;
    return membri[m.assegnato_a] ?? 'collaboratore rimosso';
  }

  function valoreColonna(m: Matter, campo: ColonnaOrdinabile): string {
    if (campo === 'cliente') return clientLabel(m.clients);
    if (campo === 'tipo') return labelFromOptions(TIPI_PRATICA, m.tipo_pratica);
    if (campo === 'stato') return labelFromOptions(STATI_PRATICA, m.stato);
    if (campo === 'aggiornata') return m.updated_at || '';
    return nomeAssegnata(m) || '';
  }

  const filtrate = matters
    .filter((m) => {
      if (filtroTipo && m.tipo_pratica !== filtroTipo) return false;
      if (filtroStato && famigliaStato(m.stato) !== filtroStato) return false;
      if (!search) return true;
      const pagliaio = [
        clientLabel(m.clients), m.numero_riferimento, m.controparte_nome,
        m.compagnia_assicurativa, m.tribunale, riferimento(m), nomeAssegnata(m),
        labelFromOptions(TIPI_PRATICA, m.tipo_pratica),
      ].filter(Boolean).join(' ').toLowerCase();
      // Tutti i termini devono comparire: cercando "mannarino generali" si
      // vuole la pratica che riguarda entrambi, non l'unione di due elenchi.
      return search.trim().toLowerCase().split(/\s+/).every((t) => pagliaio.includes(t));
    })
    .sort((a, b) => {
      const va = valoreColonna(a, ordine.campo);
      const vb = valoreColonna(b, ordine.campo);
      if (!va && vb) return 1;
      if (va && !vb) return -1;
      // Le date si confrontano come stringhe ISO, che è già l'ordine giusto.
      const cmp = ordine.campo === 'aggiornata'
        ? va.localeCompare(vb)
        : va.localeCompare(vb, 'it');
      return ordine.verso === 'asc' ? cmp : -cmp;
    });

  const conteggi = {
    totali: matters.length,
    aperte: matters.filter((m) => famigliaStato(m.stato) === 'aperta').length,
    attesa: matters.filter((m) => famigliaStato(m.stato) === 'attesa').length,
    chiuse: matters.filter((m) => famigliaStato(m.stato) === 'chiusa').length,
  };

  const pagine = Math.max(1, Math.ceil(filtrate.length / perPagina));
  const paginaCorrente = Math.min(pagina, pagine);
  const visibili = filtrate.slice((paginaCorrente - 1) * perPagina, paginaCorrente * perPagina);

  function cambiaOrdine(campo: ColonnaOrdinabile) {
    setOrdine((o) => o.campo === campo
      ? { campo, verso: o.verso === 'asc' ? 'desc' : 'asc' }
      : { campo, verso: campo === 'aggiornata' ? 'desc' : 'asc' });
  }

  /** Esporta in CSV quello che è visibile, non tutto il database. */
  function esportaCsv() {
    const intestazioni = ['Cliente', 'Riferimento', 'Tipo', 'Stato', 'Controparte', 'Compagnia', 'Tribunale', 'Aggiornata', 'Assegnata a'];
    const righe = filtrate.map((m) => [
      clientLabel(m.clients), riferimento(m),
      labelFromOptions(TIPI_PRATICA, m.tipo_pratica),
      labelFromOptions(STATI_PRATICA, m.stato),
      m.controparte_nome, m.compagnia_assicurativa, m.tribunale,
      formatDateIt(m.updated_at?.slice(0, 10)), nomeAssegnata(m),
    ]);
    const csv = [intestazioni, ...righe]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    // Il segno di ordine dei byte serve a Excel per riconoscere l'UTF-8:
    // senza, gli accenti dei nomi italiani escono illeggibili.
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pratiche-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtriAttivi = (filtroTipo ? 1 : 0) + (filtroStato ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-neutral-900">Pratiche</h1>
          <p className="mt-1 text-sm text-neutral-500">Gestisci tutte le pratiche dello studio.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bordeaux-800"
        >
          <Icon nome="piu" className="h-4 w-4" />
          Nuova pratica
        </button>
      </div>

      <div className="mb-4 rounded-2xl bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Icon nome="pratiche" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
            <input
              className="w-full rounded-lg border border-transparent bg-neutral-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              placeholder="Cerca per cliente, riferimento, controparte, tribunale..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => setMostraFiltri(!mostraFiltri)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors ${
              filtriAttivi ? 'border-bordeaux-700 text-bordeaux-700' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Icon nome="attivita" className="h-4 w-4" />
            Filtri
            {filtriAttivi > 0 && (
              <span className="rounded-full bg-bordeaux-700 px-1.5 text-[10px] text-white">{filtriAttivi}</span>
            )}
          </button>

          <button
            type="button"
            onClick={esportaCsv}
            disabled={filtrate.length === 0}
            title="Esporta in CSV le pratiche attualmente elencate"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <Icon nome="genera" className="h-4 w-4" />
            Esporta
          </button>
        </div>

        {mostraFiltri && (
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs font-medium text-neutral-500">Stato:</span>
              {[['', 'Tutti'], ['aperta', 'Aperte'], ['attesa', 'In attesa'], ['chiusa', 'Chiuse']].map(([v, l]) => (
                <button
                  key={v} type="button" onClick={() => setFiltroStato(v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    filtroStato === v ? 'bg-bordeaux-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs font-medium text-neutral-500">Materia:</span>
              <button
                type="button" onClick={() => setFiltroTipo('')}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filtroTipo === '' ? 'bg-bordeaux-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                Tutte
              </button>
              {TIPI_PRATICA.map(([v, l]) => (
                <button
                  key={v} type="button" onClick={() => setFiltroTipo(v)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    filtroTipo === v ? 'bg-bordeaux-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TesseraConteggio icona="documento" tinta="bg-violet-50 text-violet-500" valore={conteggi.totali} etichetta="Totali" />
        <TesseraConteggio icona="incarichi" tinta="bg-emerald-50 text-emerald-500" valore={conteggi.aperte} etichetta="Aperte" />
        <TesseraConteggio icona="orologio" tinta="bg-amber-50 text-amber-500" valore={conteggi.attesa} etichetta="In attesa" />
        <TesseraConteggio icona="pratiche" tinta="bg-sky-50 text-sky-500" valore={conteggi.chiuse} etichetta="Chiuse" />
      </div>

      {loading ? (
        <div className="rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-500">
          Caricamento...
        </div>
      ) : filtrate.length === 0 ? (
        <div className="rounded-2xl bg-neutral-50 py-16 text-center">
          <Icon nome="pratiche" className="mx-auto h-10 w-10 text-neutral-200" />
          <p className="mt-3 text-sm text-neutral-500">
            {search || filtriAttivi ? 'Nessuna pratica corrisponde alla ricerca.' : 'Nessuna pratica ancora.'}
          </p>
          {!search && !filtriAttivi && (
            <button onClick={() => setCreating(true)} className="mt-3 text-sm font-medium text-bordeaux-700 hover:underline">
              Crea la prima pratica
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-neutral-50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-neutral-100 text-left">
                <tr>
                  <Colonna campo="cliente" etichetta="Cliente" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="tipo" etichetta="Tipo" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="stato" etichetta="Stato" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="aggiornata" etichetta="Aggiornata" ordine={ordine} onClick={cambiaOrdine} />
                  <Colonna campo="assegnata" etichetta="Assegnata" ordine={ordine} onClick={cambiaOrdine} />
                </tr>
              </thead>
              <tbody>
                {visibili.map((m) => {
                  const famiglia = famigliaStato(m.stato);
                  const rif = riferimento(m);
                  const assegnata = nomeAssegnata(m);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => router.push(`/pratiche/${m.id}`)}
                      className="cursor-pointer border-b border-neutral-50 last:border-0 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bordeaux-50 text-xs font-semibold text-bordeaux-700">
                            {inizialiCliente(m.clients)}
                          </span>
                          <span className="min-w-0">
                            <Link
                              href={`/pratiche/${m.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate font-medium text-neutral-900 hover:text-bordeaux-700"
                            >
                              {clientLabel(m.clients)}
                            </Link>
                            {rif && <span className="block text-xs text-neutral-500">{rif}</span>}
                            {m.controparte_nome && (
                              <span className="mt-0.5 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                                c. {m.controparte_nome}
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        <span className="flex items-center gap-1.5">
                          <Icon nome="patrocinio" className="h-4 w-4 text-neutral-300" />
                          {labelFromOptions(TIPI_PRATICA, m.tipo_pratica)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STILE_STATO[famiglia].sfondo}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STILE_STATO[famiglia].punto}`} />
                          {labelFromOptions(STATI_PRATICA, m.stato)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        <span className="flex items-center gap-1.5">
                          <Icon nome="calendario" className="h-4 w-4 text-neutral-300" />
                          <span>
                            {formatDateIt(m.updated_at?.slice(0, 10))}
                            <span className="block text-xs text-neutral-400">
                              {new Date(m.updated_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <Icon nome="utente" className="h-4 w-4 text-neutral-300" />
                          {assegnata
                            ? <span className="text-neutral-700">{assegnata}</span>
                            : <span className="text-neutral-400">Non assegnata</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500">
            <span className="flex items-center gap-2">
              Mostra
              <select
                value={perPagina}
                onChange={(e) => setPerPagina(Number(e.target.value))}
                className="rounded-lg border border-transparent bg-neutral-50 px-2 py-1 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              elementi
            </span>

            <span>
              {`${(paginaCorrente - 1) * perPagina + 1}–${Math.min(paginaCorrente * perPagina, filtrate.length)} di ${filtrate.length} risultati`}
            </span>

            <span className="flex items-center gap-1">
              <button
                type="button" onClick={() => setPagina(paginaCorrente - 1)} disabled={paginaCorrente <= 1}
                aria-label="Pagina precedente"
                className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-600 disabled:opacity-40"
              >
                ‹
              </button>
              <span className="premi rounded-full bg-bordeaux-700 px-3 py-1 text-white">{paginaCorrente}</span>
              <span className="text-neutral-400">di {pagine}</span>
              <button
                type="button" onClick={() => setPagina(paginaCorrente + 1)} disabled={paginaCorrente >= pagine}
                aria-label="Pagina successiva"
                className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-600 disabled:opacity-40"
              >
                ›
              </button>
            </span>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">Nuova pratica</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Cliente</label>
                <select
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                >
                  <option value="">Seleziona...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Tipo pratica</label>
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value)}
                  className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                >
                  {TIPI_PRATICA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="mt-2 flex justify-end gap-2 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bordeaux-800"
                >
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

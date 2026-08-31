'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import { oggiIso } from '@/lib/dateUtils';
import { clientLabel, labelFromOptions, TIPI_PRATICA } from '@/lib/constants';
import {
  PRIORITA_INCARICO, STILE_PRIORITA, STATI_APERTI, scadenzaLabel,
  type StatoIncarico,
} from '@/lib/incarichi';

type ClienteRef = { tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type MatterRef = { id: string; tipo_pratica: string; clients: ClienteRef | ClienteRef[] | null };
type Incarico = {
  id: string; titolo: string; descrizione: string | null; stato: StatoIncarico;
  priorita: string; scadenza: string | null; assegnato_a: string | null;
  matter_id: string | null; matters: MatterRef | MatterRef[] | null;
};
type Membro = { user_id: string; nome: string | null; email: string };

function primo<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function IncarichiPage() {
  const supabase = createClient();
  const { userId, ruolo } = useStudio();
  const [incarichi, setIncarichi] = useState<Incarico[]>([]);
  const [membri, setMembri] = useState<Membro[]>([]);
  const [scheda, setScheda] = useState<'aperti' | 'completati'>('aperti');
  const [tuttiLoStudio, setTuttiLoStudio] = useState(false);
  const [caricando, setCaricando] = useState(true);

  const load = useCallback(async () => {
    const [{ data: inc }, { data: m }] = await Promise.all([
      supabase.from('incarichi')
        .select('id, titolo, descrizione, stato, priorita, scadenza, assegnato_a, matter_id, matters(id, tipo_pratica, clients(tipo_soggetto, nome, cognome, ragione_sociale))')
        .order('scadenza', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('studio_membri').select('user_id, nome, email').eq('stato', 'attivo'),
    ]);
    setIncarichi((inc || []) as unknown as Incarico[]);
    setMembri(((m || []) as Membro[]).filter((x) => x.user_id));
    setCaricando(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);
  useAggiornamentoLive(['incarichi'], load);

  async function aggiorna(inc: Incarico, patch: Record<string, unknown>) {
    const { error } = await supabase.from('incarichi').update(patch).eq('id', inc.id);
    if (error) { alert(error.message); return; }
    load();
  }

  const visibili = incarichi
    .filter((i) => (tuttiLoStudio ? true : i.assegnato_a === userId))
    .filter((i) => (scheda === 'aperti' ? STATI_APERTI.includes(i.stato) : !STATI_APERTI.includes(i.stato)));

  const oggi = oggiIso();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-display font-semibold text-neutral-900">
        {tuttiLoStudio ? 'Incarichi dello studio' : 'I miei incarichi'}
      </h1>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-neutral-200 text-sm">
          {(['aperti', 'completati'] as const).map((s) => (
            <button
              key={s} onClick={() => setScheda(s)}
              className={`rounded-md px-4 py-1.5 ${scheda === s ? 'bg-bordeaux-700 text-white' : 'text-neutral-600'}`}
            >
              {s === 'aperti' ? 'Da fare e in corso' : 'Chiusi'}
            </button>
          ))}
        </div>
        {ruolo === 'titolare' && (
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={tuttiLoStudio} onChange={(e) => setTuttiLoStudio(e.target.checked)} />
            Vedi tutto lo studio
          </label>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        {caricando ? (
          <p className="text-sm text-neutral-500">Caricamento...</p>
        ) : visibili.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {scheda === 'aperti' ? 'Nessun incarico aperto.' : 'Nessun incarico chiuso.'}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {visibili.map((i) => {
              const pratica = primo(i.matters);
              const cliente = pratica ? primo(pratica.clients) : null;
              const scad = scadenzaLabel(i.scadenza, oggi);
              const inRitardo = !!i.scadenza && i.scadenza < oggi && STATI_APERTI.includes(i.stato);
              return (
                <li key={i.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-800">{i.titolo}</div>
                      {i.descrizione && <div className="text-xs text-neutral-500">{i.descrizione}</div>}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                        {pratica && (
                          <Link href={`/pratiche/${pratica.id}`} className="hover:text-bordeaux-700 hover:underline">
                            {clientLabel(cliente || undefined) || 'Pratica'} · {labelFromOptions(TIPI_PRATICA, pratica.tipo_pratica)}
                          </Link>
                        )}
                        {scad && (
                          <span className={inRitardo ? 'font-medium text-red-600' : ''}>Scadenza {scad}</span>
                        )}
                        {i.priorita !== 'normale' && (
                          <span className={`rounded-full px-2 py-0.5 ${STILE_PRIORITA[i.priorita]}`}>
                            {labelFromOptions(PRIORITA_INCARICO as [string, string][], i.priorita)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap gap-1">
                      {i.stato === 'da_fare' && (
                        <button
                          onClick={() => aggiorna(i, { assegnato_a: userId, stato: 'in_corso' })}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                        >
                          Prendi in carico
                        </button>
                      )}
                      {STATI_APERTI.includes(i.stato) && (
                        <>
                          <button
                            onClick={() => aggiorna(i, { stato: 'completato', completato_at: new Date().toISOString(), completato_da: userId })}
                            className="rounded-md bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800"
                          >
                            Completa
                          </button>
                          <select
                            value=""
                            onChange={(e) => e.target.value && aggiorna(i, { assegnato_a: e.target.value, stato: 'da_fare' })}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                          >
                            <option value="">Passa a…</option>
                            {membri.filter((m) => m.user_id !== i.assegnato_a).map((m) => (
                              <option key={m.user_id} value={m.user_id}>{m.nome || m.email}</option>
                            ))}
                          </select>
                        </>
                      )}
                      {i.stato === 'completato' && (
                        <button
                          onClick={() => aggiorna(i, { stato: 'in_corso', completato_at: null, completato_da: null })}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                        >
                          Riapri
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

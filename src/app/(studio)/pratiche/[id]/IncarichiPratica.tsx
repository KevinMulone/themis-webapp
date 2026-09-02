'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import { oggiIso } from '@/lib/dateUtils';
import { labelFromOptions } from '@/lib/constants';
import {
  PRIORITA_INCARICO, STILE_PRIORITA, STILE_STATO_INCARICO, STATI_INCARICO,
  STATI_APERTI, frasStorico, scadenzaLabel, type StatoIncarico,
} from '@/lib/incarichi';

type Incarico = {
  id: string; titolo: string; descrizione: string | null; stato: StatoIncarico;
  priorita: string; scadenza: string | null; assegnato_a: string | null;
};
type Membro = { user_id: string; nome: string | null; email: string; stato: string };
type RigaStorico = {
  id: number; azione: string; attore_nome: string | null;
  a_utente_nome: string | null; created_at: string;
};

export default function IncarichiPratica({ matterId, studioId }: { matterId: string; studioId: string }) {
  const supabase = createClient();
  const { userId, ruolo } = useStudio();
  const [incarichi, setIncarichi] = useState<Incarico[]>([]);
  const [membri, setMembri] = useState<Membro[]>([]);
  const [storico, setStorico] = useState<RigaStorico[]>([]);
  const [mostraStorico, setMostraStorico] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState('');

  const load = useCallback(async () => {
    const [{ data: inc }, { data: m }, { data: st }] = await Promise.all([
      supabase.from('incarichi')
        .select('id, titolo, descrizione, stato, priorita, scadenza, assegnato_a')
        .eq('matter_id', matterId).order('created_at', { ascending: false }),
      supabase.from('studio_membri').select('user_id, nome, email, stato'),
      supabase.from('incarichi_storico')
        .select('id, azione, attore_nome, a_utente_nome, created_at, incarico_id')
        .order('created_at', { ascending: false }).limit(40),
    ]);
    const miei = new Set((inc || []).map((i) => i.id));
    setIncarichi((inc || []) as Incarico[]);
    setMembri((m || []) as Membro[]);
    setStorico(((st || []) as (RigaStorico & { incarico_id: string })[]).filter((r) => miei.has(r.incarico_id)));
  }, [supabase, matterId]);

  useEffect(() => { load(); }, [load]);
  useAggiornamentoLive(['incarichi', 'incarichi_storico'], load);

  function nomeDi(id: string | null): string {
    if (!id) return 'Nessuno';
    const m = membri.find((x) => x.user_id === id);
    if (!m) return '—';
    return `${m.nome || m.email}${m.stato !== 'attivo' ? ' (disattivato)' : ''}`;
  }

  async function handleCrea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore('');
    const form = new FormData(e.currentTarget);
    // Non è più obbligatorio: chi apre un incarico di fretta lo intitola
    // dopo. Meglio un incarico da rinominare che un incarico non creato.
    const titolo = (form.get('titolo') as string || '').trim() || 'Da definire';
    setCreando(true);
    const { error } = await supabase.from('incarichi').insert({
      studio_id: studioId,
      matter_id: matterId,
      titolo,
      assegnato_a: (form.get('assegnato_a') as string) || null,
      priorita: (form.get('priorita') as string) || 'normale',
      scadenza: (form.get('scadenza') as string) || null,
      assegnato_da: userId,
    });
    setCreando(false);
    if (error) { setErrore(error.message); return; }
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function aggiorna(inc: Incarico, patch: Record<string, unknown>) {
    const { error } = await supabase.from('incarichi').update(patch).eq('id', inc.id);
    if (error) { alert(error.message); return; }
    load();
  }

  async function elimina(inc: Incarico) {
    if (!confirm(`Eliminare l'incarico "${inc.titolo}"?`)) return;
    const { error } = await supabase.from('incarichi').delete().eq('id', inc.id);
    if (error) { alert(error.message); return; }
    load();
  }

  const oggi = oggiIso();
  const attivi = membri.filter((m) => m.stato === 'attivo' && m.user_id);

  return (
    <div className="mb-4 rounded-xl bg-neutral-50 p-6">
      <h2 className="mb-3 font-semibold text-neutral-900">Incarichi</h2>

      {incarichi.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-500">Nessun incarico su questa pratica.</p>
      ) : (
        <ul className="mb-3 divide-y divide-neutral-100 text-sm">
          {incarichi.map((i) => {
            const scad = scadenzaLabel(i.scadenza, oggi);
            const inRitardo = !!i.scadenza && i.scadenza < oggi && STATI_APERTI.includes(i.stato);
            return (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-neutral-800">{i.titolo}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${STILE_STATO_INCARICO[i.stato]}`}>
                      {labelFromOptions(STATI_INCARICO as [string, string][], i.stato)}
                    </span>
                    <span className="text-neutral-400">{nomeDi(i.assegnato_a)}</span>
                    {i.priorita !== 'normale' && (
                      <span className={`rounded-full px-2 py-0.5 ${STILE_PRIORITA[i.priorita]}`}>
                        {labelFromOptions(PRIORITA_INCARICO as [string, string][], i.priorita)}
                      </span>
                    )}
                    {scad && <span className={inRitardo ? 'font-medium text-red-600' : 'text-neutral-400'}>Scadenza {scad}</span>}
                  </div>
                </div>

                <div className="flex flex-shrink-0 flex-wrap gap-1">
                  {STATI_APERTI.includes(i.stato) && (
                    <>
                      {i.assegnato_a !== userId && (
                        <button onClick={() => aggiorna(i, { assegnato_a: userId, stato: 'in_corso' })}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">
                          Prendi in carico
                        </button>
                      )}
                      <button
                        onClick={() => aggiorna(i, { stato: 'completato', completato_at: new Date().toISOString(), completato_da: userId })}
                        className="rounded-md bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800">
                        Completa
                      </button>
                      <select
                        value=""
                        onChange={(e) => e.target.value && aggiorna(i, { assegnato_a: e.target.value, stato: 'da_fare' })}
                        className="rounded-lg border border-transparent bg-neutral-50 px-2 py-1 text-xs outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                      >
                        <option value="">Passa a…</option>
                        {attivi.filter((m) => m.user_id !== i.assegnato_a).map((m) => (
                          <option key={m.user_id} value={m.user_id}>{m.nome || m.email}</option>
                        ))}
                      </select>
                    </>
                  )}
                  {i.stato === 'completato' && (
                    <button onClick={() => aggiorna(i, { stato: 'in_corso', completato_at: null, completato_da: null })}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50">
                      Riapri
                    </button>
                  )}
                  {ruolo === 'titolare' && (
                    <button onClick={() => elimina(i)} className="px-1 text-xs text-red-600 hover:underline">
                      Elimina
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleCrea} className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
        <div className="col-span-full">
          <label className="mb-1 block text-xs text-neutral-500">
            Oggetto dell&apos;incarico{' '}
            <span className="text-neutral-400">
              (che cosa va fatto, in poche parole — si può lasciare vuoto e scriverlo dopo)
            </span>
          </label>
          <input name="titolo" placeholder="Es. Preparare la memoria di replica"
            className="w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        </div>
        <select name="assegnato_a" defaultValue="" className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
          <option value="">Non assegnato</option>
          {attivi.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome || m.email}</option>)}
        </select>
        <select name="priorita" defaultValue="normale" className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
          {PRIORITA_INCARICO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input name="scadenza" type="date" className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
        <div className="flex justify-end">
          <button type="submit" disabled={creando}
            className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
            {creando ? 'Creazione...' : 'Assegna incarico'}
          </button>
        </div>
        {errore && <p className="col-span-full text-sm text-red-600">{errore}</p>}
      </form>

      {storico.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <button onClick={() => setMostraStorico(!mostraStorico)}
            className="text-xs font-medium text-bordeaux-700 hover:underline">
            {mostraStorico ? 'Nascondi lo storico' : `Storico (${storico.length})`}
          </button>
          {mostraStorico && (
            <ul className="mt-3 space-y-1.5 text-xs text-neutral-500">
              {storico.map((r) => (
                <li key={r.id}>
                  <span className="text-neutral-400">
                    {new Date(r.created_at).toLocaleString('it-IT', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  {' — '}{frasStorico(r)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

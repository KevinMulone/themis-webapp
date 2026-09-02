'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';
import { oggiIso } from '@/lib/dateUtils';
import { clientLabel, labelFromOptions, TIPI_PRATICA } from '@/lib/constants';
import { Icon, type NomeIcona } from '@/components/ui/Icon';
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

/**
 * Un suggerimento nello stato vuoto.
 *
 * È un collegamento vero, non un riquadro illustrativo: se lo spazio
 * vuoto suggerisce di usare il calendario, deve portarci. Un consiglio
 * che non si può seguire con un clic è un consiglio scritto per riempire.
 */
function Suggerimento({ href, icona, titolo, testo }: {
  href: string; icona: NomeIcona; titolo: string; testo: string;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-4 rounded-xl p-3 transition-colors hover:bg-neutral-50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-600">
        <Icon nome={icona} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900 group-hover:text-bordeaux-700">
          {titolo}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{testo}</span>
      </span>
    </Link>
  );
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

  const miei = incarichi.filter((i) => (tuttiLoStudio ? true : i.assegnato_a === userId));
  const aperti = miei.filter((i) => STATI_APERTI.includes(i.stato));
  const chiusi = miei.filter((i) => !STATI_APERTI.includes(i.stato));
  const visibili = scheda === 'aperti' ? aperti : chiusi;

  const oggi = oggiIso();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-neutral-900">
          {tuttiLoStudio ? 'Incarichi dello studio' : 'I miei incarichi'}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {tuttiLoStudio
            ? 'Tutti gli incarichi assegnati nello studio, di chiunque siano.'
            : 'Gestisci e monitora tutti i tuoi incarichi.'}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {([
            ['aperti', 'Da fare e in corso', aperti.length],
            ['completati', 'Chiusi', chiusi.length],
          ] as const).map(([chiave, etichetta, quanti]) => (
            <button
              key={chiave} onClick={() => setScheda(chiave)}
              className={`premi flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                scheda === chiave
                  ? 'bg-bordeaux-700 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {etichetta}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                scheda === chiave ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {quanti}
              </span>
            </button>
          ))}
        </div>

        {ruolo === 'titolare' && (
          <button
            type="button"
            onClick={() => setTuttiLoStudio(!tuttiLoStudio)}
            aria-pressed={tuttiLoStudio}
            className={`premi flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tuttiLoStudio
                ? 'bg-bordeaux-700 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <Icon nome="occhio" className="h-4 w-4" />
            {tuttiLoStudio ? 'Solo i miei' : 'Vedi tutto lo studio'}
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-neutral-50">
        {caricando ? (
          <p className="p-6 text-sm text-neutral-500">Caricamento...</p>
        ) : visibili.length === 0 ? (
          <>
            <div className="px-6 py-14 text-center">
              <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-bordeaux-50 text-bordeaux-300">
                <Icon nome="incarichi" className="h-9 w-9" />
              </span>
              <h2 className="text-lg font-semibold text-neutral-900">
                {scheda === 'aperti' ? 'Nessun incarico aperto' : 'Nessun incarico chiuso'}
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
                {scheda === 'aperti'
                  ? tuttiLoStudio
                    ? 'Nessuno nello studio ha incarichi da svolgere in questo momento.'
                    : 'Al momento non hai incarichi da svolgere. Quando avrai attività assegnate, le troverai qui.'
                  : 'Gli incarichi completati o annullati compariranno qui.'}
              </p>
              {scheda === 'aperti' && (
                <Link
                  href="/pratiche"
                  className="premi mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 hover:text-bordeaux-700"
                >
                  <Icon nome="piu" className="h-4 w-4" />
                  {/* Gli incarichi nascono dentro una pratica: è lì che si
                      crea, e mandarci è più utile di un pulsante qui che
                      non saprebbe a quale fascicolo attaccarli. */}
                  Assegna un incarico da una pratica
                </Link>
              )}
            </div>

            <div className="border-t border-neutral-100 p-6">
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">Suggerimenti</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:divide-x md:divide-neutral-100">
                <Suggerimento
                  href="/calendario" icona="calendario" titolo="Organizza il tuo lavoro"
                  testo="Usa il calendario per pianificare udienze, termini e appuntamenti."
                />
                <div className="md:pl-2">
                  <Suggerimento
                    href="/pratiche" icona="pratiche" titolo="Tieni tutto sotto controllo"
                    testo="Sfoglia le pratiche e assegna gli incarichi dal fascicolo."
                  />
                </div>
                <div className="md:pl-2">
                  <Suggerimento
                    href="/pec" icona="campanella" titolo="Rimani aggiornato"
                    testo="Le PEC in arrivo accendono la campanella: nessuna scadenza sfugge."
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <ul className="divide-y divide-neutral-100 p-6 text-sm">
            {visibili.map((i) => {
              const pratica = primo(i.matters);
              const cliente = pratica ? primo(pratica.clients) : null;
              const scad = scadenzaLabel(i.scadenza, oggi);
              const inRitardo = !!i.scadenza && i.scadenza < oggi && STATI_APERTI.includes(i.stato);
              return (
                <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900">{i.titolo}</div>
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

                    <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                      {i.stato === 'da_fare' && (
                        <button
                          onClick={() => aggiorna(i, { assegnato_a: userId, stato: 'in_corso' })}
                          className="premi rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                        >
                          Prendi in carico
                        </button>
                      )}
                      {STATI_APERTI.includes(i.stato) && (
                        <>
                          <button
                            onClick={() => aggiorna(i, { stato: 'completato', completato_at: new Date().toISOString(), completato_da: userId })}
                            className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
                          >
                            Completa
                          </button>
                          <select
                            value=""
                            onChange={(e) => e.target.value && aggiorna(i, { assegnato_a: e.target.value, stato: 'da_fare' })}
                            className="rounded-lg border border-transparent bg-neutral-50 px-2 py-1.5 text-xs outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
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
                          className="premi rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
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

      <Link
        href="/themis"
        className="group mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-5 transition-colors hover:bg-violet-50"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-violet-500">
          <Icon nome="stelle" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-neutral-900">Consiglio di Themis</span>
          <span className="block text-xs leading-relaxed text-neutral-600">
            Prima di preparare un atto, chiedi a Themis cosa dicono i documenti della pratica:
            la risposta cita documento e pagina, e ti risparmia la rilettura.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3.5 py-2 text-sm font-medium text-violet-700">
          Apri Themis
          <Icon nome="freccia" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}

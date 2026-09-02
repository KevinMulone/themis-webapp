import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { oggiIso, addDaysIso } from '@/lib/dateUtils';
import { TIPI_EVENTO, TIPI_PRATICA, STATI_PRATICA, labelFromOptions, clientLabel, formatDateIt } from '@/lib/constants';
import { STATI_APERTI } from '@/lib/incarichi';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

type ScadenzaRow = { id: string; titolo: string; tipo: string; data: string; ora_inizio: string | null };
type ClienteRef = { tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type PraticaRow = { id: string; tipo_pratica: string; stato: string; updated_at: string; clients: ClienteRef | ClienteRef[] | null };

function giorniA(dataIso: string, oggi: string): string {
  const diff = Math.round((new Date(dataIso).getTime() - new Date(oggi).getTime()) / 86400000);
  if (diff < 0) return `scaduta da ${Math.abs(diff)}gg`;
  if (diff === 0) return 'oggi';
  if (diff === 1) return 'domani';
  return `tra ${diff}gg`;
}

function primoCliente(c: ClienteRef | ClienteRef[] | null): ClienteRef | null {
  if (!c) return null;
  return Array.isArray(c) ? c[0] || null : c;
}

/**
 * I colori delle tessere.
 *
 * Scritti per intero e non composti a runtime: Tailwind include nel
 * foglio di stile solo le classi che trova scritte così nel sorgente.
 * Una classe assemblata con un template letterale non verrebbe mai
 * vista, e il colore sparirebbe dal sito pubblicato pur essendo giusto
 * nel codice.
 */
const TINTE = {
  rosa: 'bg-rose-50 text-rose-500',
  ambra: 'bg-amber-50 text-amber-500',
  viola: 'bg-violet-50 text-violet-500',
  verde: 'bg-emerald-50 text-emerald-500',
  blu: 'bg-sky-50 text-sky-500',
  bordeaux: 'bg-bordeaux-50 text-bordeaux-600',
} as const;

/**
 * Una tessera del riepilogo: icona colorata, numero, etichetta.
 *
 * È sempre un collegamento: un numero che incuriosisce e non si può
 * aprire è una frustrazione. Dove il numero conta un problema da
 * gestire (prenotazioni in attesa, incarichi aperti) diventa ambra
 * quando è maggiore di zero — il colore segnala che c'è da fare
 * qualcosa, non decora.
 */
function Tessera({ href, icona, tinta, valore, titolo, sottotitolo, allerta = false }: {
  href: string; icona: NomeIcona; tinta: keyof typeof TINTE;
  valore: number | string; titolo: string; sottotitolo?: string; allerta?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rialzo group flex flex-col rounded-2xl bg-neutral-50 p-5"
    >
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${TINTE[tinta]}`}>
        <Icon nome={icona} className="h-5 w-5" />
      </div>
      <div className={`text-3xl font-bold ${allerta ? 'text-amber-600' : 'text-neutral-900'}`}>
        {valore}
      </div>
      <div className="mt-1 text-sm font-medium text-neutral-700">{titolo}</div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className="text-xs text-neutral-400">{sottotitolo}</span>
        <Icon nome="freccia" className="h-4 w-4 text-neutral-300 group-hover:text-bordeaux-600" />
      </div>
    </Link>
  );
}

/** L'intestazione di una sezione: titolo a sinistra, collegamento a destra. */
function TestataSezione({ icona, titolo, href, azione }: {
  icona: NomeIcona; titolo: string; href: string; azione: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
        <Icon nome={icona} className="h-[18px] w-[18px] text-bordeaux-600" />
        {titolo}
      </h2>
      <Link
        href={href}
        className="premi rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-bordeaux-700"
      >
        {azione}
      </Link>
    </div>
  );
}

/** Le scorciatoie in fondo: le cinque cose che si fanno più spesso. */
function AzioneRapida({ href, icona, testo }: { href: string; icona: NomeIcona; testo: string }) {
  return (
    <Link
      href={href}
      className="premi flex items-center gap-2.5 rounded-xl bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-bordeaux-700"
    >
      <Icon nome={icona} className="h-[18px] w-[18px] text-bordeaux-600" />
      {testo}
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  // Il layout reindirizza già quando il contesto manca, ma in Next.js
  // layout e pagina vengono generati in parallelo: la pagina può arrivare
  // qui prima che il reindirizzamento del layout abbia effetto. Dare per
  // scontato il contesto (com'era prima, con un "!") trasformava quel
  // momento in un errore fatale invece che in un reindirizzamento.
  const ctx = await contestoStudio();
  if (!ctx) redirect('/attiva');
  const studioId = ctx.studioId;

  const oggi = oggiIso();
  const tra7gg = addDaysIso(oggi, 7);
  const tipiScadenza = ['udienza', 'termine_processuale', 'scadenza'];

  const [
    { count: clientsCount },
    { count: matterCount },
    { count: prossimeScadenzeCount },
    { count: prenotazioniInAttesaCount },
    { count: pecCount },
    { count: incarichiCount },
    { data: prossimeScadenze },
    { data: praticheRecenti },
  ] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('studio_id', studioId).eq('archiviato', false),
    supabase.from('matters').select('id', { count: 'exact', head: true }).eq('studio_id', studioId).neq('stato', 'archiviata'),
    supabase.from('eventi').select('id', { count: 'exact', head: true }).in('tipo', tipiScadenza).gte('data', oggi).lte('data', tra7gg),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('stato', 'in_attesa'),
    // Solo le PEC non lette: un totale che sale e non scende mai non è
    // un'informazione su cui agire, è un contatore d'archivio.
    supabase.from('pec_messaggi').select('id', { count: 'exact', head: true })
      .eq('tipo_pec', 'posta-certificata').eq('letta', false),
    supabase.from('incarichi').select('id', { count: 'exact', head: true })
      .eq('assegnato_a', ctx.userId).in('stato', STATI_APERTI),
    supabase.from('eventi')
      .select('id, titolo, tipo, data, ora_inizio')
      .in('tipo', tipiScadenza)
      .gte('data', oggi)
      .order('data').order('ora_inizio')
      .limit(5),
    supabase.from('matters')
      .select('id, tipo_pratica, stato, updated_at, clients(tipo_soggetto, nome, cognome, ragione_sociale)')
      .eq('studio_id', studioId)
      .neq('stato', 'archiviata')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  const scadenze = (prossimeScadenze || []) as ScadenzaRow[];
  const pratiche = (praticheRecenti || []) as unknown as PraticaRow[];

  const oggiEsteso = new Date(oggi).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bentornato, ecco cosa sta succedendo oggi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            <Icon nome="calendario" className="h-4 w-4 text-neutral-400" />
            {oggiEsteso}
          </span>
          <Link
            href="/pratiche"
            className="flex items-center gap-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bordeaux-800"
          >
            <Icon nome="piu" className="h-4 w-4" />
            Nuova pratica
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Tessera
          href="/clienti" icona="clienti" tinta="rosa"
          valore={clientsCount ?? 0} titolo="Clienti" sottotitolo="Totali"
        />
        <Tessera
          href="/pratiche" icona="pratiche" tinta="ambra"
          valore={matterCount ?? 0} titolo="Pratiche attive" sottotitolo="In corso"
        />
        <Tessera
          href="/calendario" icona="calendario" tinta="viola"
          valore={prossimeScadenzeCount ?? 0} titolo="Udienze/termini" sottotitolo="(7gg)"
        />
        <Tessera
          href="/calendario" icona="invio" tinta="verde"
          valore={prenotazioniInAttesaCount ?? 0} titolo="Prenotazioni da confermare"
          allerta={(prenotazioniInAttesaCount ?? 0) > 0}
        />
        <Tessera
          href="/pec" icona="pec" tinta="blu"
          valore={pecCount ?? 0} titolo="Messaggi PEC" sottotitolo="Non letti"
          allerta={(pecCount ?? 0) > 0}
        />
        <Tessera
          href="/incarichi" icona="incarichi" tinta="bordeaux"
          valore={incarichiCount ?? 0} titolo="Incarichi da fare" sottotitolo="Aperti"
          allerta={(incarichiCount ?? 0) > 0}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-neutral-50 p-6">
          <TestataSezione icona="orologio" titolo="Prossime scadenze" href="/calendario" azione="Vedi calendario" />
          {scadenze.length === 0 ? (
            <div className="py-10 text-center">
              <Icon nome="calendario" className="mx-auto h-10 w-10 text-neutral-200" />
              <p className="mt-3 text-sm text-neutral-500">Nessuna udienza o termine in vista.</p>
              <p className="text-sm text-neutral-400">Goditi la giornata.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {scadenze.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-800">{ev.titolo}</div>
                    <div className="text-xs text-neutral-400">
                      {labelFromOptions(TIPI_EVENTO, ev.tipo)} · {formatDateIt(ev.data)}
                      {ev.ora_inizio && ` ${ev.ora_inizio.slice(0, 5)}`}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                    {giorniA(ev.data, oggi)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-neutral-50 p-6">
          <TestataSezione icona="pratiche" titolo="Pratiche recenti" href="/pratiche" azione="Vedi tutte" />
          {pratiche.length === 0 ? (
            <div className="py-10 text-center">
              <Icon nome="pratiche" className="mx-auto h-10 w-10 text-neutral-200" />
              <p className="mt-3 text-sm text-neutral-500">Nessuna pratica ancora.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {pratiche.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/pratiche/${m.id}`}
                    className="group flex items-center gap-3 py-3 transition-colors hover:text-bordeaux-700"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bordeaux-50 text-bordeaux-600">
                      <Icon nome="documento" className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-neutral-800 group-hover:text-bordeaux-700">
                        {clientLabel(primoCliente(m.clients) || undefined)}
                      </span>
                      <span className="block text-xs text-neutral-400">
                        {labelFromOptions(TIPI_PRATICA, m.tipo_pratica)} · {labelFromOptions(STATI_PRATICA, m.stato)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {formatDateIt(m.updated_at.slice(0, 10))}
                    </span>
                    <Icon nome="freccia" className="h-4 w-4 shrink-0 text-neutral-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-neutral-50 p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Azioni rapide</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <AzioneRapida href="/clienti" icona="clienti" testo="Nuovo cliente" />
          <AzioneRapida href="/pratiche" icona="pratiche" testo="Nuova pratica" />
          <AzioneRapida href="/pec" icona="pec" testo="Nuova PEC" />
          <AzioneRapida href="/incarichi" icona="incarichi" testo="Nuovo incarico" />
          <AzioneRapida href="/calendario" icona="calendario" testo="Nuovo appuntamento" />
        </div>
      </div>
    </div>
  );
}

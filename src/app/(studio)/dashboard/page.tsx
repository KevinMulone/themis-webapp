import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { oggiIso, addDaysIso } from '@/lib/dateUtils';
import { TIPI_EVENTO, TIPI_PRATICA, STATI_PRATICA, labelFromOptions, clientLabel, formatDateIt } from '@/lib/constants';
import { STATI_APERTI } from '@/lib/incarichi';
import { Icon, type NomeIcona } from '@/components/ui/Icon';
import HoverLift from '@/components/motion/HoverLift';

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
  rosa: 'bg-rose-50 text-rose-500 ring-rose-100',
  ambra: 'bg-amber-50 text-amber-500 ring-amber-100',
  viola: 'bg-violet-50 text-violet-500 ring-violet-100',
  verde: 'bg-emerald-50 text-emerald-500 ring-emerald-100',
  blu: 'bg-sky-50 text-sky-500 ring-sky-100',
  bordeaux: 'bg-bordeaux-50 text-bordeaux-600 ring-bordeaux-100',
} as const;

const ACCENTI = {
  rosa: 'from-rose-400/70 to-rose-200/20', ambra: 'from-amber-400/70 to-amber-200/20',
  viola: 'from-violet-400/70 to-violet-200/20', verde: 'from-emerald-400/70 to-emerald-200/20',
  blu: 'from-sky-400/70 to-sky-200/20', bordeaux: 'from-bordeaux-500/80 to-bordeaux-200/20',
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
    <HoverLift tilt className="h-full">
    <Link
      href={href}
      className="metric-card group relative flex h-full min-h-[190px] flex-col overflow-hidden rounded-[26px] bg-white/90 p-5 ring-1 ring-black/[0.045] backdrop-blur-sm"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ACCENTI[tinta]}`} aria-hidden="true" />
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${TINTE[tinta]} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[-3deg]`}>
        <Icon nome={icona} className="h-5 w-5" />
      </div>
      <div className={`text-[34px] font-semibold leading-none tracking-[-.04em] ${allerta ? 'text-bordeaux-700' : 'text-neutral-950'}`}>
        {valore}
      </div>
      <div className="mt-2 text-sm font-semibold leading-tight text-neutral-700">{titolo}</div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className="text-xs text-neutral-400">{sottotitolo}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-50 transition-all group-hover:translate-x-0.5 group-hover:bg-bordeaux-50">
          <Icon nome="freccia" className="h-3.5 w-3.5 text-neutral-300 group-hover:text-bordeaux-600" />
        </span>
      </div>
    </Link>
    </HoverLift>
  );
}

/** L'intestazione di una sezione: titolo a sinistra, collegamento a destra. */
function TestataSezione({ icona, titolo, href, azione }: {
  icona: NomeIcona; titolo: string; href: string; azione: string;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-3 text-lg font-semibold tracking-[-.02em] text-neutral-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bordeaux-50 text-bordeaux-600"><Icon nome={icona} className="h-[17px] w-[17px]" /></span>
        {titolo}
      </h2>
      <Link
        href={href}
        className="premi rounded-full bg-neutral-50 px-3.5 py-2 text-xs font-medium text-neutral-600 ring-1 ring-black/[0.04] transition-colors hover:bg-bordeaux-50 hover:text-bordeaux-700"
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
      className="premi group flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-medium text-white/85 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-gold-300 transition-transform group-hover:scale-105"><Icon nome={icona} className="h-[17px] w-[17px]" /></span>
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
    { count: eventiTotaliCount },
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
    supabase.from('eventi').select('id', { count: 'exact', head: true }).limit(1),
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
  const onboarding = [
    { fatto: (clientsCount ?? 0) > 0, href: '/clienti', titolo: 'Inserisci il primo cliente', testo: 'Crea l’anagrafica da cui nasceranno le pratiche.' },
    { fatto: (matterCount ?? 0) > 0, href: '/pratiche', titolo: 'Apri la prima pratica', testo: 'Collega cliente, materia e responsabile.' },
    { fatto: (eventiTotaliCount ?? 0) > 0, href: '/calendario', titolo: 'Aggiungi un impegno', testo: 'Registra un’udienza, una scadenza o un appuntamento.' },
  ];
  const onboardingCompletati = onboarding.filter((passo) => passo.fatto).length;

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-bordeaux-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.1)]" /> Studio operativo</div>
          <h1 className="font-display text-[36px] font-semibold tracking-[-.045em] text-neutral-950 sm:text-[44px]">Dashboard</h1>
          <p className="mt-1 text-[15px] text-neutral-500 sm:text-base">
            Bentornato, ecco cosa sta succedendo oggi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2.5 text-sm text-neutral-600 shadow-sm ring-1 ring-black/[0.04] backdrop-blur-sm">
            <Icon nome="calendario" className="h-4 w-4 text-neutral-400" />
            {oggiEsteso}
          </span>
          <Link
            href="/pratiche"
            className="shine-button premi flex items-center gap-2 rounded-full bg-bordeaux-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-bordeaux-800"
          >
            <Icon nome="piu" className="h-4 w-4" />
            Nuova pratica
          </Link>
        </div>
      </div>

      {onboardingCompletati < onboarding.length && (
        <section className="mb-6 overflow-hidden rounded-[24px] bg-gradient-to-br from-bordeaux-800 to-bordeaux-950 p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold-300">Primi passi</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Configura lo studio</h2>
              <p className="mt-1 text-sm text-white/65">Tre passaggi per rendere Themis subito operativo.</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/10">{onboardingCompletati} di {onboarding.length}</span>
          </div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${(onboardingCompletati / onboarding.length) * 100}%` }} />
          </div>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {onboarding.map((passo, indice) => (
              <Link key={passo.titolo} href={passo.href} className={`flex items-start gap-3 rounded-2xl p-3 ring-1 transition ${passo.fatto ? 'bg-white/5 text-white/45 ring-white/5' : 'bg-white/10 ring-white/10 hover:bg-white/15'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${passo.fatto ? 'bg-emerald-400/20 text-emerald-200' : 'bg-gold-400 text-bordeaux-950'}`}>
                  {passo.fatto ? '✓' : indice + 1}
                </span>
                <span>
                  <span className={`block text-sm font-medium ${passo.fatto ? 'line-through' : ''}`}>{passo.titolo}</span>
                  <span className="mt-0.5 block text-xs text-white/50">{passo.testo}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-3 flex items-end justify-between">
        <div><h2 className="text-lg font-semibold tracking-[-.02em] text-neutral-900">Panoramica operativa</h2><p className="mt-0.5 text-xs text-neutral-400">I numeri che richiedono la tua attenzione.</p></div>
        <span className="hidden items-center gap-1.5 text-xs text-neutral-400 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 respiro" /> aggiornato ora</span>
      </section>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
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

      <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="dashboard-panel rounded-[28px] bg-white/90 p-5 sm:p-6">
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
                <li key={ev.id} className="riga-reattiva -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-neutral-50">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-neutral-800">{ev.titolo}</div>
                    <div className="text-xs text-neutral-400">
                      {labelFromOptions(TIPI_EVENTO, ev.tipo)} · {formatDateIt(ev.data)}
                      {ev.ora_inizio && ` ${ev.ora_inizio.slice(0, 5)}`}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-bordeaux-50 px-2.5 py-1 text-xs font-medium text-bordeaux-700 ring-1 ring-bordeaux-100">
                    {giorniA(ev.data, oggi)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-panel rounded-[28px] bg-white/90 p-5 sm:p-6">
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
                    className="riga-reattiva group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-neutral-50 hover:text-bordeaux-700"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bordeaux-50 text-bordeaux-600 ring-1 ring-bordeaux-100">
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

      <div className="relative mt-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-bordeaux-800 to-bordeaux-950 p-6 text-white shadow-[0_28px_70px_-44px_rgba(69,18,36,.7)]">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gold-300/10 blur-2xl" />
        <div className="relative mb-5 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-gold-300">Scorciatoie</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Cosa vuoi fare adesso?</h2></div><p className="text-xs text-white/45">Arriva alla funzione in un solo clic.</p></div>
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

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import NotificheCampanella from './NotificheCampanella';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

type NavItem = { href: string; label: string; badge?: number };
type RisultatoRicerca = {
  tipo: 'cliente' | 'pratica' | 'documento';
  id: string; titolo: string; sottotitolo: string; href: string;
};

const ICONE: Record<string, NomeIcona> = {
  '/dashboard': 'dashboard',
  '/clienti': 'clienti',
  '/pratiche': 'pratiche',
  '/themis': 'themis',
  '/incarichi': 'incarichi',
  '/calendario': 'calendario',
  '/whatsapp': 'whatsapp',
  '/whatsapp/documenti': 'documento',
  '/genera': 'genera',
  '/deposito': 'invio',
  '/calcolo-danno': 'calcolo',
  '/parcelle': 'parcelle',
  '/patrocinio': 'patrocinio',
  '/registri-giustizia': 'tribunale',
  '/fascicoli-rfid': 'etichetta',
  '/studi': 'edificio',
  '/domande-frequenti': 'aiuto',
  '/attivita': 'attivita',
  '/collaboratori': 'collaboratori',
  '/impostazioni': 'impostazioni',
};

const GRUPPI: { titolo: string; hrefs: string[] }[] = [
  { titolo: 'Studio', hrefs: ['/dashboard', '/clienti', '/pratiche', '/themis', '/incarichi'] },
  { titolo: 'Comunicazioni', hrefs: ['/calendario', '/pec'] },
  { titolo: 'Strumenti', hrefs: ['/genera', '/calcolo-danno', '/parcelle', '/patrocinio', '/registri-giustizia', '/fascicoli-rfid'] },
  { titolo: 'Account', hrefs: ['/attivita', '/collaboratori', '/impostazioni', '/studi', '/domande-frequenti'] },
];

export default function SidebarNav({ navItems, nomeStudio, abbonamentoLabel }: {
  navItems: NavItem[]; nomeStudio: string; abbonamentoLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [ricercaAperta, setRicercaAperta] = useState(false);
  const [query, setQuery] = useState('');
  const [risultati, setRisultati] = useState<RisultatoRicerca[]>([]);
  const [ricercaInCorso, setRicercaInCorso] = useState(false);
  const inputRicerca = useRef<HTMLInputElement>(null);
  const elencoRef = useRef<HTMLElement | null>(null);
  const [bordi, setBordi] = useState({ su: false, giu: false });
  const pathname = usePathname();

  useEffect(() => {
    function scorciatoia(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setRicercaAperta(true);
      }
      if (event.key === 'Escape') setRicercaAperta(false);
    }
    window.addEventListener('keydown', scorciatoia);
    return () => window.removeEventListener('keydown', scorciatoia);
  }, []);

  useEffect(() => {
    if (!ricercaAperta) return;
    requestAnimationFrame(() => inputRicerca.current?.focus());
  }, [ricercaAperta]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setRisultati([]);
      setRicercaInCorso(false);
      return;
    }
    const controller = new AbortController();
    setRicercaInCorso(true);
    const timer = window.setTimeout(async () => {
      try {
        const risposta = await fetch(`/api/ricerca?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = await risposta.json();
        if (risposta.ok) setRisultati(body.risultati ?? []);
      } catch (errore) {
        if ((errore as Error).name !== 'AbortError') setRisultati([]);
      } finally {
        if (!controller.signal.aborted) setRicercaInCorso(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  // Dice se l'elenco continua sopra o sotto: serve a far sfumare i bordi e a non nascondere voci senza che si veda.
  function aggiornaBordi() {
    const el = elencoRef.current;
    if (!el) return;
    const su = el.scrollTop > 4;
    const giu = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setBordi((b) => (b.su === su && b.giu === giu ? b : { su, giu }));
  }
  useEffect(() => { aggiornaBordi(); });  // a ogni disegno: cambiano le voci, i contatori, la finestra
  useEffect(() => {
    window.addEventListener('resize', aggiornaBordi);
    return () => window.removeEventListener('resize', aggiornaBordi);
  }, []);

  // L'abbonamento in una riga sola: "1050 gg"; giallo sotto i 30 giorni, rosso se scade a breve o è scaduto.
  const abbonamentoBreve = abbonamentoLabel
    ?.replace('scade tra ', '').replace(' giorni', ' gg').replace('scade ', '') ?? null;
  const giorniAbb = abbonamentoLabel ? Number(abbonamentoLabel.match(/\d+/)?.[0] ?? NaN) : NaN;
  const abbRosso = !!abbonamentoLabel && /scaduto|oggi|domani/.test(abbonamentoLabel);
  const abbGiallo = !abbRosso && Number.isFinite(giorniAbb) && giorniAbb <= 30;

  function eVoceAttiva(href: string) {
    if (href === '/whatsapp') return pathname === '/whatsapp';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const perHref = new Map(navItems.map((v) => [v.href, v]));
  const usati = new Set<string>();
  const sezioni = GRUPPI.map((g) => ({
    titolo: g.titolo,
    voci: g.hrefs.map((h) => perHref.get(h)).filter((v): v is NavItem => Boolean(v)),
  })).filter((s) => s.voci.length);
  sezioni.forEach((s) => s.voci.forEach((v) => usati.add(v.href)));
  const resto = navItems.filter((v) => !usati.has(v.href));
  if (resto.length) sezioni.push({ titolo: 'Altro', voci: resto });

  const navContent = (
    <>
      <div className="mx-2 mt-1 flex items-center gap-3 px-2 py-2">
        <span className="relative">
          <span className="absolute -inset-1 rounded-[14px] bg-bordeaux-500/40 blur-md" aria-hidden="true" />
          <Image src="/icon.svg" alt="" width={36} height={36} className="relative rounded-[11px] ring-1 ring-white/15" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-bold uppercase leading-tight tracking-[.18em] text-white">Themis</h1>
          <p className="truncate font-mono text-[10.5px] leading-tight text-neutral-400">{nomeStudio || 'il tuo studio'}</p>
        </div>
        <NotificheCampanella scuro />
      </div>

      <button
        type="button"
        onClick={() => setRicercaAperta(true)}
        className="group mx-2 mb-3 mt-1 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-[12.5px] text-neutral-400 transition hover:border-bordeaux-400/60 hover:bg-white/[0.08] hover:text-neutral-200"
      >
        <Icon nome="cerca" className="h-4 w-4 text-neutral-500 transition group-hover:text-bordeaux-300" />
        <span className="flex-1">Cerca nello studio</span>
        <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">⌘K</kbd>
      </button>

      <nav
        ref={elencoRef}
        onScroll={aggiornaBordi}
        data-su={bordi.su ? '1' : '0'}
        data-giu={bordi.giu ? '1' : '0'}
        className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-2 [@media(max-height:820px)]:gap-3"
      >
        {sezioni.map((sezione, idx) => (
          <div key={`${sezione.titolo}-${idx}`}>
            <p className="flex items-center gap-2 px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">
              <span className="text-bordeaux-400/80">{String(idx + 1).padStart(2, '0')}</span>
              {sezione.titolo}
              <span className="h-px flex-1 bg-gradient-to-r from-white/[0.12] to-transparent" aria-hidden="true" />
            </p>
            <div className="flex flex-col gap-0.5">
              {sezione.voci.map((item) => {
                const attiva = eVoceAttiva(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={attiva ? 'page' : undefined}
                    className={`premi group relative flex items-center gap-2.5 rounded-xl px-2 py-[6px] text-[13px] tracking-tight transition [@media(max-height:820px)]:py-[4px] ${
                      attiva
                        ? 'bg-gradient-to-r from-white/[0.10] to-white/[0.03] font-medium text-white ring-1 ring-white/10'
                        : 'text-neutral-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {attiva && (
                      <span
                        className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-bordeaux-300 shadow-[0_0_14px_3px_rgba(219,139,160,.65)]"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                        attiva
                          ? 'bg-gradient-to-br from-bordeaux-400 to-bordeaux-700 text-white shadow-[0_0_18px_-3px_rgba(191,81,112,.85)] ring-1 ring-white/20'
                          : 'text-neutral-500 group-hover:bg-white/[0.08] group-hover:text-bordeaux-300'
                      }`}
                    >
                      {ICONE[item.href] && <Icon nome={ICONE[item.href]} className="h-[15px] w-[15px]" />}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={`min-w-[20px] rounded-md px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold tabular-nums ${
                          attiva ? 'bg-bordeaux-500 text-white' : 'bg-bordeaux-500/20 text-bordeaux-200 ring-1 ring-bordeaux-400/25'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.07] px-2 pb-1 pt-2">
        {abbonamentoLabel && (
          <Link
            href="/impostazioni#abbonamento"
            onClick={() => setOpen(false)}
            className={`rialzo mb-1.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] ring-1 ${
              abbRosso ? 'bg-red-500/10 text-red-200 ring-red-400/30'
                : abbGiallo ? 'bg-amber-500/10 text-amber-200 ring-amber-400/30'
                : 'bg-white/[0.04] text-neutral-300 ring-white/10'
            }`}
          >
            <Icon nome="abbonamento" className={`h-3.5 w-3.5 ${abbRosso ? 'text-red-300' : abbGiallo ? 'text-amber-300' : 'text-gold-300'}`} />
            <span className="font-medium">Abbonamento</span>
            <span className="ml-auto font-mono text-[11px] opacity-80">{abbonamentoBreve}</span>
          </Link>
        )}
        <div className="flex items-center justify-between">
          <LogoutButton className="premi flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] text-neutral-400 hover:bg-white/[0.07] hover:text-white">
            <Icon nome="esci" className="h-4 w-4 text-neutral-500" />
            Esci
          </LogoutButton>
          <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[.14em] text-neutral-500">beta</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="barra-tek flex items-center justify-between px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="" width={24} height={24} className="rounded-[7px] ring-1 ring-white/15" />
          <span className="text-[14px] font-bold uppercase tracking-[.18em] text-white">Themis</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificheCampanella scuro />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri il menu"
            className="premi rounded-full p-2 text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="5" x2="18" y2="5" />
              <line x1="2" y1="10" x2="18" y2="10" />
              <line x1="2" y1="15" x2="18" y2="15" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="sidebar-tek absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col py-2 shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}

      <aside className="sidebar-tek hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[276px] lg:flex-shrink-0 lg:flex-col lg:py-2">
        {navContent}
      </aside>

      {ricercaAperta && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setRicercaAperta(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Ricerca globale"
            className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white/95 shadow-[0_40px_100px_-45px_rgba(0,0,0,.65)] ring-1 ring-black/10 backdrop-blur-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
              <Icon nome="cerca" className="h-5 w-5 text-bordeaux-600" />
              <label htmlFor="ricerca-globale" className="sr-only">Cerca clienti, pratiche e documenti</label>
              <input
                ref={inputRicerca}
                id="ricerca-globale"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca cliente, R.G. o documento…"
                className="min-w-0 flex-1 bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              <button type="button" onClick={() => setRicercaAperta(false)} className="rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100">ESC</button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-400">Scrivi almeno due caratteri per cercare in tutto lo studio.</p>
              ) : ricercaInCorso ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-400">Ricerca in corso…</p>
              ) : risultati.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-400">Nessun risultato trovato.</p>
              ) : risultati.map((risultato) => (
                <Link
                  key={`${risultato.tipo}-${risultato.id}`}
                  href={risultato.href}
                  onClick={() => { setRicercaAperta(false); setOpen(false); }}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-neutral-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bordeaux-50 text-bordeaux-600">
                    <Icon nome={risultato.tipo === 'cliente' ? 'utente' : 'documento'} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-800">{risultato.titolo}</span>
                    <span className="block truncate text-xs capitalize text-neutral-400">{risultato.tipo} · {risultato.sottotitolo}</span>
                  </span>
                  <Icon nome="freccia" className="h-4 w-4 text-neutral-300" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

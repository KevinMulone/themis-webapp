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

// Le due versioni del menu: ogni voce dell'aspetto sta qui, così il resto del componente non cambia.
const TEMI = {
  scuro: {
    asideDesktop: 'sidebar-tek', asideMobile: 'sidebar-tek', barra: 'barra-tek',
    logo: 'ring-1 ring-white/15', logoAlone: 'bg-bordeaux-500/40 blur-md',
    titolo: 'text-[15px] font-bold uppercase tracking-[.18em] text-white',
    studio: 'font-mono text-[10.5px] text-neutral-400',
    cerca: 'border border-white/10 bg-white/[0.04] text-neutral-400 hover:border-bordeaux-400/60 hover:bg-white/[0.08] hover:text-neutral-200',
    cercaIcona: 'text-neutral-500 group-hover:text-bordeaux-300',
    kbd: 'border-white/15 bg-white/[0.06] font-mono text-neutral-400',
    sezTitolo: 'font-mono text-[10px] font-medium tracking-[0.2em] text-neutral-500', sezNumero: 'text-bordeaux-400/80',
    sezLinea: 'from-white/[0.12]',
    voceAttiva: 'bg-gradient-to-r from-white/[0.10] to-white/[0.03] font-medium text-white ring-1 ring-white/10',
    voceInattiva: 'text-neutral-400 hover:bg-white/[0.06] hover:text-white',
    lineaAttiva: 'absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-bordeaux-300 shadow-[0_0_14px_3px_rgba(219,139,160,.65)]',
    tileAttiva: 'bg-gradient-to-br from-bordeaux-400 to-bordeaux-700 text-white shadow-[0_0_18px_-3px_rgba(191,81,112,.85)] ring-1 ring-white/20',
    tileInattiva: 'text-neutral-500 group-hover:bg-white/[0.08] group-hover:text-bordeaux-300',
    badgeAttivo: 'bg-bordeaux-500 text-white', badgeInattivo: 'bg-bordeaux-500/20 text-bordeaux-200 ring-1 ring-bordeaux-400/25',
    badge: 'rounded-md font-mono',
    piede: 'border-white/[0.07]',
    abb: 'bg-white/[0.04] text-neutral-300 ring-white/10', abbRosso: 'bg-red-500/10 text-red-200 ring-red-400/30',
    abbGiallo: 'bg-amber-500/10 text-amber-200 ring-amber-400/30',
    abbIcona: 'text-gold-300', abbIconaRosso: 'text-red-300', abbIconaGiallo: 'text-amber-300', abbValore: 'font-mono',
    esci: 'text-neutral-400 hover:bg-white/[0.07] hover:text-white', esciIcona: 'text-neutral-500',
    beta: 'rounded-md border border-white/10 font-mono text-neutral-500',
    tema: 'text-neutral-400 hover:bg-white/10 hover:text-white',
    hamburger: 'text-neutral-300 hover:bg-white/10 hover:text-white', mobileTitolo: 'text-[14px] font-bold uppercase tracking-[.18em] text-white',
    mobileLogo: 'ring-1 ring-white/15',
  },
  chiaro: {
    asideDesktop: 'vetro lg:border-r lg:border-white/70 lg:shadow-[16px_0_55px_-48px_rgba(45,12,24,.38)]',
    asideMobile: 'vetro border-r border-white/70', barra: 'vetro border-b border-black/[0.06]',
    logo: 'shadow-[0_10px_22px_-12px_rgba(69,18,36,.85)]', logoAlone: 'hidden',
    titolo: 'text-[16px] font-bold tracking-[-.03em] text-neutral-950',
    studio: 'text-[11.5px] text-neutral-500',
    cerca: 'bg-white/80 ring-1 ring-black/[0.06] text-neutral-500 hover:bg-white hover:ring-bordeaux-200',
    cercaIcona: 'text-neutral-400 group-hover:text-bordeaux-600',
    kbd: 'border-neutral-200 bg-white font-sans text-neutral-400',
    sezTitolo: 'font-semibold tracking-[0.14em] text-neutral-400', sezNumero: 'hidden',
    sezLinea: 'from-black/[0.07]',
    voceAttiva: 'bg-gradient-to-r from-bordeaux-50 via-white/90 to-white/60 font-semibold text-bordeaux-900 shadow-[0_8px_22px_-16px_rgba(69,18,36,.55)] ring-1 ring-bordeaux-100/80',
    voceInattiva: 'text-neutral-600 hover:bg-white/60 hover:text-neutral-900',
    lineaAttiva: 'hidden',
    tileAttiva: 'bg-bordeaux-600 text-white shadow-[0_6px_14px_-6px_rgba(124,36,64,.8)]',
    tileInattiva: 'text-neutral-400 group-hover:bg-bordeaux-50 group-hover:text-bordeaux-600',
    badgeAttivo: 'bg-bordeaux-600 text-white', badgeInattivo: 'bg-bordeaux-50 text-bordeaux-700',
    badge: 'rounded-full',
    piede: 'border-black/[0.05]',
    abb: 'bg-gradient-to-r from-gold-50/80 to-white/70 text-neutral-700 ring-gold-100/80', abbRosso: 'bg-red-50 text-red-800 ring-red-100',
    abbGiallo: 'bg-amber-50 text-amber-900 ring-amber-100',
    abbIcona: 'text-gold-600', abbIconaRosso: 'text-red-600', abbIconaGiallo: 'text-amber-600', abbValore: '',
    esci: 'text-neutral-600 hover:bg-white/70 hover:text-neutral-900', esciIcona: 'text-neutral-400',
    beta: 'rounded-full bg-neutral-100 text-neutral-400',
    tema: 'text-neutral-500 hover:bg-white/80 hover:text-bordeaux-700',
    hamburger: 'text-neutral-700 hover:bg-white/70', mobileTitolo: 'text-[15px] font-semibold tracking-tight text-neutral-900',
    mobileLogo: '',
  },
} as const;
type Tema = keyof typeof TEMI;

const GRUPPI: { titolo: string; hrefs: string[] }[] = [
  { titolo: 'Studio', hrefs: ['/dashboard', '/clienti', '/pratiche', '/themis', '/incarichi'] },
  { titolo: 'Comunicazioni', hrefs: ['/calendario', '/pec'] },
  { titolo: 'Strumenti', hrefs: ['/genera', '/calcolo-danno', '/parcelle', '/patrocinio', '/registri-giustizia', '/fascicoli-rfid'] },
  { titolo: 'Account', hrefs: ['/attivita', '/collaboratori', '/impostazioni', '/studi', '/domande-frequenti'] },
];

export default function SidebarNav({ navItems, nomeStudio, abbonamentoLabel, temaIniziale = 'scuro' }: {
  navItems: NavItem[]; nomeStudio: string; abbonamentoLabel: string | null; temaIniziale?: Tema;
}) {
  const [tema, setTema] = useState<Tema>(temaIniziale);
  const t = TEMI[tema];
  const scuro = tema === 'scuro';
  function cambiaTema() {
    const nuovo: Tema = scuro ? 'chiaro' : 'scuro';
    setTema(nuovo);
    // Ricordato un anno su questo computer; il server lo legge e disegna subito il menu giusto.
    document.cookie = `themis-menu=${nuovo}; path=/; max-age=31536000; samesite=lax`;
  }
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
          <span className={`absolute -inset-1 rounded-[14px] ${t.logoAlone}`} aria-hidden="true" />
          <Image src="/icon.svg" alt="" width={36} height={36} className={`relative rounded-[11px] ${t.logo}`} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className={`leading-tight ${t.titolo}`}>Themis</h1>
          <p className={`truncate leading-tight ${t.studio}`}>{nomeStudio || 'il tuo studio'}</p>
        </div>
        <NotificheCampanella scuro={scuro} />
      </div>

      <button
        type="button"
        onClick={() => setRicercaAperta(true)}
        className={`group mx-2 mb-3 mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] transition ${t.cerca}`}
      >
        <Icon nome="cerca" className={`h-4 w-4 transition ${t.cercaIcona}`} />
        <span className="flex-1">Cerca nello studio</span>
        <kbd className={`rounded-md border px-1.5 py-0.5 text-[10px] ${t.kbd}`}>⌘K</kbd>
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
            <p className={`flex items-center gap-2 px-3 pb-1 text-[10px] uppercase ${t.sezTitolo}`}>
              <span className={t.sezNumero}>{String(idx + 1).padStart(2, '0')}</span>
              {sezione.titolo}
              <span className={`h-px flex-1 bg-gradient-to-r to-transparent ${t.sezLinea}`} aria-hidden="true" />
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
                      attiva ? t.voceAttiva : t.voceInattiva
                    }`}
                  >
                    {attiva && <span className={t.lineaAttiva} aria-hidden="true" />}
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${attiva ? t.tileAttiva : t.tileInattiva}`}>
                      {ICONE[item.href] && <Icon nome={ICONE[item.href]} className="h-[15px] w-[15px]" />}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={`min-w-[20px] px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums ${t.badge} ${
                          attiva ? t.badgeAttivo : t.badgeInattivo
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

      <div className={`border-t px-2 pb-1 pt-2 ${t.piede}`}>
        {abbonamentoLabel && (
          <Link
            href="/impostazioni#abbonamento"
            onClick={() => setOpen(false)}
            className={`rialzo mb-1.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] ring-1 ${abbRosso ? t.abbRosso : abbGiallo ? t.abbGiallo : t.abb}`}
          >
            <Icon nome="abbonamento" className={`h-3.5 w-3.5 ${abbRosso ? t.abbIconaRosso : abbGiallo ? t.abbIconaGiallo : t.abbIcona}`} />
            <span className="font-medium">Abbonamento</span>
            <span className={`ml-auto text-[11px] opacity-80 ${t.abbValore}`}>{abbonamentoBreve}</span>
          </Link>
        )}
        <div className="flex items-center justify-between">
          <LogoutButton className={`premi flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] ${t.esci}`}>
            <Icon nome="esci" className={`h-4 w-4 ${t.esciIcona}`} />
            Esci
          </LogoutButton>
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cambiaTema}
              title={scuro ? 'Passa al menu chiaro' : 'Passa al menu scuro'}
              aria-label={scuro ? 'Passa al menu chiaro' : 'Passa al menu scuro'}
              className={`premi flex h-7 w-7 items-center justify-center rounded-lg transition ${t.tema}`}
            >
              <Icon nome={scuro ? 'sole' : 'luna'} className="h-4 w-4" />
            </button>
            <span className={`px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[.14em] ${t.beta}`}>beta</span>
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className={`flex items-center justify-between px-4 py-3 lg:hidden ${t.barra}`}>
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="" width={24} height={24} className={`rounded-[7px] ${t.mobileLogo}`} />
          <span className={t.mobileTitolo}>Themis</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificheCampanella scuro={scuro} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri il menu"
            className={`premi rounded-full p-2 ${t.hamburger}`}
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
          <aside className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col py-2 shadow-2xl ${t.asideMobile}`}>
            {navContent}
          </aside>
        </div>
      )}

      <aside className={`hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[276px] lg:flex-shrink-0 lg:flex-col lg:py-2 ${t.asideDesktop}`}>
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

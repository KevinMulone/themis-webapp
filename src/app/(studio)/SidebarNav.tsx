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
  tipo: 'cliente' | 'pratica' | 'documento' | 'pec';
  id: string; titolo: string; sottotitolo: string; href: string;
};

const ICONE: Record<string, NomeIcona> = {
  '/dashboard': 'dashboard',
  '/clienti': 'clienti',
  '/pratiche': 'pratiche',
  '/themis': 'themis',
  '/incarichi': 'incarichi',
  '/calendario': 'calendario',
  '/pec': 'pec',
  '/whatsapp': 'whatsapp',
  '/whatsapp/documenti': 'documento',
  '/genera': 'genera',
  '/deposito': 'invio',
  '/calcolo-danno': 'calcolo',
  '/parcelle': 'parcelle',
  '/patrocinio': 'patrocinio',
  '/registri-giustizia': 'cerca',
  '/studi': 'edificio',
  '/domande-frequenti': 'aiuto',
  '/attivita': 'attivita',
  '/collaboratori': 'collaboratori',
  '/impostazioni': 'impostazioni',
};

const GRUPPI: { titolo: string; hrefs: string[] }[] = [
  { titolo: 'Studio', hrefs: ['/dashboard', '/clienti', '/pratiche', '/themis', '/incarichi'] },
  { titolo: 'Comunicazioni', hrefs: ['/calendario', '/pec'] },
  { titolo: 'Strumenti', hrefs: ['/genera', '/calcolo-danno', '/parcelle', '/patrocinio', '/registri-giustizia'] },
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
      <div className="flex items-center gap-2.5 px-3 pb-5 pt-2">
        <Image src="/icon.svg" alt="" width={28} height={28} className="rounded-[8px] shadow-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold tracking-tight text-neutral-900">Themis</h1>
          <p className="truncate text-[11px] text-neutral-500">{nomeStudio}</p>
        </div>
        <NotificheCampanella />
      </div>

      <button
        type="button"
        onClick={() => setRicercaAperta(true)}
        className="mx-2 mb-4 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-left text-xs text-neutral-500 ring-1 ring-black/[0.05] transition hover:bg-white"
      >
        <Icon nome="cerca" className="h-4 w-4" />
        <span className="flex-1">Cerca nello studio</span>
        <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-400">⌘K</kbd>
      </button>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-3">
        {sezioni.map((sezione, idx) => (
          <div key={`${sezione.titolo}-${idx}`}>
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              {sezione.titolo}
            </p>
            <div className="flex flex-col gap-px">
              {sezione.voci.map((item) => {
                const attiva = eVoceAttiva(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={attiva ? 'page' : undefined}
                    className={`premi flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13px] tracking-tight ${
                      attiva
                        ? 'bg-white font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,.06)] ring-1 ring-black/[0.04]'
                        : 'text-neutral-600 hover:bg-white/60'
                    }`}
                  >
                    {ICONE[item.href] && (
                      <Icon
                        nome={ICONE[item.href]}
                        className={`h-4 w-4 shrink-0 ${attiva ? 'text-bordeaux-700' : 'text-neutral-400'}`}
                      />
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          attiva ? 'bg-neutral-900 text-white' : 'bg-neutral-200/80 text-neutral-600'
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

      <div className="px-2 pb-2">
        {abbonamentoLabel && (
          <Link
            href="/impostazioni"
            onClick={() => setOpen(false)}
            className="mb-2 block rounded-2xl bg-white/70 p-3 ring-1 ring-black/[0.04]"
          >
            <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-800">
              <Icon nome="abbonamento" className="h-3.5 w-3.5 text-gold-600" />
              Abbonamento
            </div>
            <p className="mt-0.5 text-[11px] text-neutral-500">{abbonamentoLabel}</p>
          </Link>
        )}
        <LogoutButton />
        <p className="pt-3 text-center text-[10px] text-neutral-400">Versione beta</p>
      </div>
    </>
  );

  return (
    <>
      <div className="vetro flex items-center justify-between border-b border-black/[0.06] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="" width={24} height={24} className="rounded-[7px]" />
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">Themis</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificheCampanella />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri il menu"
            className="premi rounded-full p-2 text-neutral-700 hover:bg-white/70"
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
          <aside className="vetro absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-black/[0.06] py-2">
            {navContent}
          </aside>
        </div>
      )}

      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-black/[0.05] lg:bg-transparent lg:py-2">
        {navContent}
      </aside>

      {ricercaAperta && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setRicercaAperta(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Ricerca globale"
            className="w-full max-w-2xl overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-black/10"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
              <Icon nome="cerca" className="h-5 w-5 text-bordeaux-600" />
              <label htmlFor="ricerca-globale" className="sr-only">Cerca clienti, pratiche, documenti e PEC</label>
              <input
                ref={inputRicerca}
                id="ricerca-globale"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca cliente, R.G., documento o PEC…"
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
                    <Icon nome={risultato.tipo === 'cliente' ? 'utente' : risultato.tipo === 'pec' ? 'pec' : 'documento'} className="h-[18px] w-[18px]" />
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

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import NotificheCampanella from './NotificheCampanella';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

type NavItem = { href: string; label: string; badge?: number };

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
  const pathname = usePathname();

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
    </>
  );
}

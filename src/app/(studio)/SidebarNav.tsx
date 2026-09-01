'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import NotificheCampanella from './NotificheCampanella';
import { Icon, type NomeIcona } from '@/components/ui/Icon';

type NavItem = { href: string; label: string; badge?: number };

/**
 * L'icona di ogni voce di menu.
 *
 * Sta qui e non nella definizione delle voci (nel layout, che è un
 * componente server) perché le icone sono JSX: farle attraversare il
 * confine server/client significherebbe serializzarle, cosa che React
 * non fa. La chiave è l'indirizzo, che è già l'identità della voce.
 */
const ICONE: Record<string, NomeIcona> = {
  '/dashboard': 'dashboard',
  '/clienti': 'clienti',
  '/pratiche': 'pratiche',
  '/themis': 'themis',
  '/incarichi': 'incarichi',
  '/calendario': 'calendario',
  '/pec': 'pec',
  '/genera': 'genera',
  '/calcolo-danno': 'calcolo',
  '/parcelle': 'parcelle',
  '/patrocinio': 'patrocinio',
  '/attivita': 'attivita',
  '/collaboratori': 'collaboratori',
  '/impostazioni': 'impostazioni',
};

export default function SidebarNav({ navItems, nomeStudio, abbonamentoLabel }: {
  navItems: NavItem[]; nomeStudio: string; abbonamentoLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function eVoceAttiva(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <Image src="/icon.svg" alt="" width={36} height={36} className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold tracking-wide text-bordeaux-800">
            THEMIS
          </h1>
          <p className="truncate text-[11px] text-neutral-500">{nomeStudio}</p>
        </div>
        <NotificheCampanella />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {navItems.map((item) => {
          const attiva = eVoceAttiva(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={attiva ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                attiva
                  ? 'bg-bordeaux-700 font-semibold text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-bordeaux-800'
              }`}
            >
              {ICONE[item.href] && (
                <Icon
                  nome={ICONE[item.href]}
                  className={`h-[18px] w-[18px] shrink-0 ${attiva ? '' : 'text-neutral-400'}`}
                />
              )}
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    attiva ? 'bg-white/20 text-white' : 'bg-bordeaux-700 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        {abbonamentoLabel && (
          <Link
            href="/impostazioni"
            onClick={() => setOpen(false)}
            className="mb-3 block rounded-lg border border-gold-300 bg-gold-50 p-3 transition-colors hover:bg-gold-100"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
              <Icon nome="abbonamento" className="h-4 w-4 text-gold-600" />
              Abbonamento
            </div>
            <p className="mt-0.5 text-[11px] text-neutral-500">{abbonamentoLabel}</p>
            <p className="mt-1.5 text-[11px] font-medium text-bordeaux-700">Gestisci abbonamento</p>
          </Link>
        )}
        <LogoutButton />
        <p className="mt-3 text-center text-[10px] text-neutral-300">Creato da Kevin M. D.</p>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superiore, solo sotto lg */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-display text-base font-semibold text-bordeaux-800">Themis</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificheCampanella />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri il menu"
            className="rounded-md border border-neutral-300 p-2 text-neutral-700"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="5" x2="18" y2="5" />
              <line x1="2" y1="10" x2="18" y2="10" />
              <line x1="2" y1="15" x2="18" y2="15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Drawer, solo sotto lg */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-lg">
            {navContent}
          </aside>
        </div>
      )}

      {/* Sidebar fissa, da lg in su. È una scheda staccata dal bordo, non
          una colonna attaccata: lo stesso linguaggio delle schede del
          contenuto, così la pagina si legge come un insieme di riquadri
          invece che come due zone diverse incollate. */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:p-4 lg:pr-0">
        <div className="flex w-full flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {navContent}
        </div>
      </aside>
    </>
  );
}

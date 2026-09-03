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
  '/whatsapp': 'whatsapp',
  '/whatsapp/documenti': 'documento',
  '/genera': 'genera',
  '/deposito': 'invio',
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
      <div className="flex items-center gap-2.5 px-3 pb-6 pt-1">
        <Image src="/icon.svg" alt="" width={22} height={22} className="rounded-md" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold tracking-tight text-neutral-900">Themis</h1>
          <p className="truncate text-[11px] text-neutral-500">{nomeStudio}</p>
        </div>
        <NotificheCampanella />
      </div>

      <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-2 pb-3">
        {navItems.map((item) => {
          const attiva = eVoceAttiva(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={attiva ? 'page' : undefined}
              className={`premi flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] tracking-tight ${
                attiva
                  ? 'bg-bordeaux-700/[0.08] font-medium text-bordeaux-700'
                  : 'text-neutral-600 hover:bg-neutral-50'
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
                    attiva ? 'bg-bordeaux-700 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-1">
        {abbonamentoLabel && (
          <Link
            href="/impostazioni"
            onClick={() => setOpen(false)}
            className="rialzo mb-1 block rounded-xl bg-neutral-50 p-3"
          >
            <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-800">
              <Icon nome="abbonamento" className="h-3.5 w-3.5 text-gold-600" />
              Abbonamento
            </div>
            <p className="mt-0.5 text-[11px] text-neutral-500">{abbonamentoLabel}</p>
          </Link>
        )}
        <div className="border-t border-neutral-200/70 pt-1">
          <LogoutButton />
        </div>
        <p className="pb-2 pt-2 text-center text-[10px] text-neutral-300">Creato da Kevin M. D.</p>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superiore, solo sotto lg */}
      <div className="vetro flex items-center justify-between border-b border-neutral-200/70 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="" width={24} height={24} className="rounded-md" />
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">Themis</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificheCampanella />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri il menu"
            className="premi rounded-full p-2 text-neutral-700 hover:bg-neutral-100"
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
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="vetro absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-neutral-200/70">
            {navContent}
          </aside>
        </div>
      )}

      {/* Sidebar fissa, da lg in su: galleggia sulla pagina bianca, senza
          bordo né ombra propria — solo un filo sottile a destra la separa
          dal contenuto, come nelle app di sistema di Apple. */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-neutral-200/70 lg:py-2">
        {navContent}
      </aside>
    </>
  );
}

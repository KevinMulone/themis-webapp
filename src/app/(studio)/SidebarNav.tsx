'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

type NavItem = { href: string; label: string };

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
      <div className="flex items-center gap-3 border-b-2 border-gold-500 px-5 py-4">
        <Image src="/icon.svg" alt="" width={32} height={32} className="rounded-md" />
        <div>
          <h1 className="font-display text-lg font-semibold tracking-wide text-bordeaux-800">Themis</h1>
          <p className="text-xs text-neutral-500">{nomeStudio}</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`rounded-md px-3 py-2 text-sm ${
              eVoceAttiva(item.href)
                ? 'bg-gold-100 font-medium text-bordeaux-800'
                : 'text-neutral-700 hover:bg-gold-100 hover:text-bordeaux-800'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-neutral-200 p-3 text-center">
        {abbonamentoLabel && (
          <p className="mb-2 text-[11px] text-neutral-400">Abbonamento: {abbonamentoLabel}</p>
        )}
        <LogoutButton />
        <p className="mt-3 text-[10px] text-neutral-300">Created by Kevin M. D.</p>
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

      {/* Drawer, solo sotto lg */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-lg">
            {navContent}
          </aside>
        </div>
      )}

      {/* Sidebar fissa, da lg in su */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        {navContent}
      </aside>
    </>
  );
}

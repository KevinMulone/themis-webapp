'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BrandHero from '@/components/BrandHero';

type StudioPubblico = {
  nome_studio: string | null;
  elenco_paese: string | null;
  elenco_via: string | null;
  elenco_citta: string | null;
  elenco_cap: string | null;
  elenco_sito: string | null;
};

export default function StudiPage() {
  const [studi, setStudi] = useState<StudioPubblico[]>([]);
  const [paese, setPaese] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/studi-pubblici')
      .then((r) => r.json())
      .then((b) => setStudi(b.studi || []))
      .catch(() => setStudi([]));
  }, []);

  const paesi = useMemo(
    () => [...new Set(studi.map((s) => s.elenco_paese).filter(Boolean) as string[])].sort(),
    [studi],
  );

  const filtrati = studi.filter((s) => {
    if (paese && s.elenco_paese !== paese) return false;
    const blob = `${s.nome_studio} ${s.elenco_citta} ${s.elenco_via}`.toLowerCase();
    if (q && !blob.includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <BrandHero titolo="Studi su Themis" />
      <p className="mx-auto mb-8 max-w-xl text-center text-sm leading-relaxed text-neutral-600">
        Studi con abbonamento annuale che hanno scelto di farsi trovare.
        Themis non certifica l&rsquo;iscrizione all&rsquo;albo: i dati li dichiara lo studio.
      </p>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca studio o città"
          className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <select
          value={paese}
          onChange={(e) => setPaese(e.target.value)}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        >
          <option value="">Tutti i paesi</option>
          {paesi.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {filtrati.length === 0 ? (
        <p className="rounded-2xl bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          Nessuno studio in elenco per questi filtri.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.04]">
          {filtrati.map((s, i) => (
            <li key={`${s.nome_studio}-${i}`} className="px-5 py-4">
              <div className="font-semibold text-neutral-900">{s.nome_studio || 'Studio'}</div>
              <div className="mt-1 text-sm text-neutral-600">
                {[s.elenco_via, s.elenco_cap, s.elenco_citta].filter(Boolean).join(', ')}
              </div>
              <div className="text-xs text-neutral-400">{s.elenco_paese}</div>
              {s.elenco_sito && /^https?:\/\//i.test(s.elenco_sito) && (
                <a href={s.elenco_sito} className="mt-1 inline-block text-sm text-bordeaux-700 hover:underline" target="_blank" rel="noreferrer">
                  Sito dello studio
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-center text-sm text-neutral-500">
        Hai il piano annuale? Pubblica lo studio da{' '}
        <Link href="/impostazioni" className="underline">Impostazioni</Link>
        {' · '}
        <Link href="/" className="underline">Home</Link>
      </p>
    </div>
  );
}

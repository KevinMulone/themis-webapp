'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Dati = {
  nome_studio: string | null;
  plan: string | null;
  subscription_status: string | null;
  elenco_pubblico: boolean;
  elenco_paese: string;
  elenco_via: string;
  elenco_citta: string;
  elenco_cap: string;
  elenco_sito: string;
};

export default function ImpostazioniElenco() {
  const [dati, setDati] = useState<Dati | null>(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/elenco-studio')
      .then((r) => r.json())
      .then((b) => {
        const s = b.studio;
        if (!s) { setDati(null); return; }
        setDati({
          nome_studio: s.nome_studio,
          plan: s.plan,
          subscription_status: s.subscription_status,
          elenco_pubblico: !!s.elenco_pubblico,
          elenco_paese: s.elenco_paese || 'Italia',
          elenco_via: s.elenco_via || '',
          elenco_citta: s.elenco_citta || '',
          elenco_cap: s.elenco_cap || '',
          elenco_sito: s.elenco_sito || '',
        });
      })
      .catch(() => setDati(null));
  }, []);

  if (!dati) return null;

  const premium = dati.plan === 'annuale' && ['active', 'trialing'].includes(dati.subscription_status || '');

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    if (!dati) return;
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/elenco-studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dati),
    });
    const b = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? 'Scheda aggiornata.' : (b.error || 'Salvataggio non riuscito'));
  }

  return (
    <form onSubmit={salva} className="mb-4 rounded-2xl bg-white p-6 ring-1 ring-black/[0.04]">
      <h2 className="mb-1 font-semibold text-neutral-900">Elenco studi</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Pagina pubblica <Link href="/studi" className="underline">/studi</Link>, visibile ai clienti.
        Solo piano annuale attivo. Senza la spunta resti invisibile.
      </p>
      {!premium ? (
        <p className="text-sm text-neutral-600">
          Il tuo piano è {dati.plan || 'nessuno'}. Per entrare in elenco serve l&rsquo;abbonamento annuale.
        </p>
      ) : (
        <>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dati.elenco_pubblico}
              onChange={(e) => setDati({ ...dati, elenco_pubblico: e.target.checked })}
            />
            Pubblica il mio studio in elenco
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-neutral-500">
              Paese
              <input value={dati.elenco_paese} onChange={(e) => setDati({ ...dati, elenco_paese: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-neutral-500">
              Città
              <input value={dati.elenco_citta} onChange={(e) => setDati({ ...dati, elenco_citta: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-neutral-500 md:col-span-2">
              Via e n. civico
              <input value={dati.elenco_via} onChange={(e) => setDati({ ...dati, elenco_via: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-neutral-500">
              CAP
              <input value={dati.elenco_cap} onChange={(e) => setDati({ ...dati, elenco_cap: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-neutral-500">
              Sito (facoltativo)
              <input value={dati.elenco_sito} onChange={(e) => setDati({ ...dati, elenco_sito: e.target.value })} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
            {msg && <span className="text-sm text-neutral-600">{msg}</span>}
            <button disabled={saving} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Salva scheda'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

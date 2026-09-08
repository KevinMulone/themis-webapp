'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandHero from '@/components/BrandHero';

const PIANI = [
  { key: 'logo', nome: 'Logo', quando: 'Anticipato, prima di andare online', prezzo: '150 €', periodo: '/mese', cosa: 'Logo in fondo alla home e in questa pagina. 30 giorni dal pagamento.' },
  { key: 'partner', nome: 'Partner', quando: 'Anticipato', prezzo: '400 €', periodo: '/3 mesi', cosa: 'Logo + box con due righe e link. 90 giorni dal pagamento.' },
  { key: 'main', nome: 'Main partner', quando: 'Anticipato', prezzo: '1.200 €', periodo: '/anno', cosa: 'Modulo in home, evidenza qui, citazione in un post X. 365 giorni dal pagamento.' },
] as const;

type Sponsor = { nome: string; url: string | null; logo_url: string | null; piano: string };

export default function SponsorPage() {
  const [lista, setLista] = useState<Sponsor[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [piano, setPiano] = useState('logo');
  const [messaggio, setMessaggio] = useState('');
  const [stato, setStato] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errore, setErrore] = useState('');
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    fetch('/api/sponsor')
      .then((r) => r.json())
      .then((b) => setLista(b.sponsor || []))
      .catch(() => setLista([]));
  }, []);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setInvio(true);
    setStato('idle');
    setErrore('');
    const res = await fetch('/api/sponsor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, piano, messaggio }),
    });
    setInvio(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrore(b.error || 'Invio non riuscito');
      setStato('err');
      return;
    }
    setStato('ok');
    setNome(''); setEmail(''); setMessaggio('');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <BrandHero titolo="Diventa sponsor" />
      <p className="mx-auto mb-10 max-w-xl text-center text-sm leading-relaxed text-neutral-600">
        Visibilità su Themis, l&rsquo;app di gestione per studi legali.
        Si paga prima. Il logo compare solo dopo l&rsquo;accredito, per il periodo acquistato.
        Massimo sei spazi in home.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {PIANI.map((p) => (
          <div key={p.key} className="rounded-2xl bg-white p-5 ring-1 ring-black/[0.04]">
            <div className="text-xs text-neutral-500">{p.quando}</div>
            <h2 className="mt-1 font-semibold">{p.nome}</h2>
            <div className="mt-2 text-2xl font-bold">{p.prezzo}<span className="text-sm font-normal text-neutral-500">{p.periodo}</span></div>
            <p className="mt-3 text-sm text-neutral-600">{p.cosa}</p>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-xl text-center text-sm text-neutral-500">
        Hai il piano annuale di Themis? Lo spazio Logo è già incluso, gratis: scrivicelo nel modulo qui sotto.
      </p>

      {lista.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-center font-semibold">Chi c&rsquo;è ora</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lista.map((s) => (
              <li key={s.nome} className="rounded-2xl bg-neutral-50 px-5 py-4">
                <div className="text-xs uppercase tracking-wide text-neutral-400">{s.piano}</div>
                <div className="font-semibold">{s.nome}</div>
                {s.url && /^https?:\/\//i.test(s.url) && <a href={s.url} className="text-sm text-bordeaux-700 hover:underline" target="_blank" rel="noreferrer">{s.url}</a>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={invia} className="mt-12 space-y-3 rounded-2xl bg-white p-6 ring-1 ring-black/[0.04]">
        <h2 className="font-semibold">Richiedi lo spazio</h2>
        <p className="text-sm text-neutral-500">Ti rispondiamo con IBAN o link di pagamento. Niente pubblicazione prima del saldo.</p>
        <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome azienda" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        <select value={piano} onChange={(e) => setPiano(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
          {PIANI.map((p) => <option key={p.key} value={p.key}>{p.nome} — {p.prezzo}{p.periodo}</option>)}
        </select>
        <textarea value={messaggio} onChange={(e) => setMessaggio(e.target.value)} rows={3} placeholder="Due righe sul prodotto (facoltativo)" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
        <button disabled={invio} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {invio ? 'Invio...' : 'Invia la richiesta'}
        </button>
        {stato === 'ok' && <p className="text-sm text-green-700">Richiesta inviata. Ti contattiamo per il pagamento.</p>}
        {stato === 'err' && <p className="text-sm text-red-600">{errore}</p>}
      </form>

      <p className="mt-8 text-center text-sm text-neutral-500">
        <Link href="/" className="underline">Home</Link>
        {' · '}
        <Link href="/studi" className="underline">Elenco studi</Link>
      </p>
    </div>
  );
}

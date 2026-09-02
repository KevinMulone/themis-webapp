'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandHero from '@/components/BrandHero';

const PIANI = [
  { key: 'monthly', nome: 'Mensile', prezzo: '100€/mese', dettaglio: 'Fatturazione mensile, disdici quando vuoi.' },
  { key: 'semestrale', nome: 'Semestrale', prezzo: '500€/6 mesi', dettaglio: 'Un mese omaggio rispetto al mensile.' },
  { key: 'annuale', nome: 'Annuale', prezzo: '1.100€/anno', dettaglio: 'Include le future funzionalità AI.' },
] as const;

function AttivaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutEsito = searchParams.get('checkout');

  const [tab, setTab] = useState<'chiave' | 'abbonati'>('chiave');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pianoInCorso, setPianoInCorso] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!key.trim()) {
      setError('Inserisci una chiave di licenza.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error || 'Attivazione non riuscita');
      return;
    }
    router.push('/dashboard');
  }

  async function handleAbbonati(piano: string) {
    setPianoInCorso(piano);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: piano }),
      });
      let body: { url?: string; error?: string } = {};
      try {
        body = await res.json();
      } catch {
        // La risposta non era JSON (es. una pagina di errore generica del server).
      }
      if (!res.ok || !body.url) {
        setPianoInCorso(null);
        alert(body.error || `Impossibile avviare il pagamento (errore ${res.status})`);
        return;
      }
      window.location.href = body.url;
    } catch {
      setPianoInCorso(null);
      alert('Impossibile contattare il server. Riprova.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-neutral-50 p-8">
        <BrandHero />
        <p className="mb-6 text-center text-sm text-neutral-500">Attiva il tuo account</p>

        {checkoutEsito === 'success' && (
          <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
            Pagamento completato. Controlla la tua email: ti abbiamo inviato la chiave di attivazione da incollare qui sotto.
          </p>
        )}
        {checkoutEsito === 'cancel' && (
          <p className="mb-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">
            Pagamento annullato. Puoi riprovare quando vuoi.
          </p>
        )}

        <div className="mb-4 flex rounded-full bg-neutral-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab('chiave')}
            className={`premi flex-1 rounded-full py-1.5 ${tab === 'chiave' ? 'bg-bordeaux-700 text-white' : 'text-neutral-600'}`}
          >
            Ho una chiave
          </button>
          <button
            type="button"
            onClick={() => setTab('abbonati')}
            className={`premi flex-1 rounded-full py-1.5 ${tab === 'abbonati' ? 'bg-bordeaux-700 text-white' : 'text-neutral-600'}`}
          >
            Abbonati ora
          </button>
        </div>

        {tab === 'chiave' ? (
          <>
            <p className="mb-4 text-sm text-neutral-600">
              Inserisci la chiave di licenza che ti è stata fornita per attivare l&apos;abbonamento.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <textarea
                className="min-h-24 rounded-lg border border-transparent bg-neutral-50 px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                placeholder="THM-....."
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                {loading ? 'Attivazione...' : 'Attiva'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {PIANI.map((p) => (
              <div key={p.key} className="rounded-2xl bg-neutral-50 p-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-semibold text-neutral-900">{p.nome}</span>
                  <span className="font-semibold text-bordeaux-700">{p.prezzo}</span>
                </div>
                <p className="mb-3 text-xs text-neutral-500">{p.dettaglio}</p>
                <button
                  onClick={() => handleAbbonati(p.key)}
                  disabled={pianoInCorso !== null}
                  className="w-full premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                >
                  {pianoInCorso === p.key ? 'Reindirizzamento...' : 'Scegli questo piano'}
                </button>
              </div>
            ))}
            <p className="text-center text-xs text-neutral-400">
              Dopo il pagamento riceverai via email la chiave di attivazione da incollare nella scheda &quot;Ho una chiave&quot;.
              {' '}Garanzia di rimborso entro 4 giorni: <a href="/politica-rimborsi" target="_blank" className="underline">leggi la policy</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttivaPage() {
  return (
    <Suspense fallback={null}>
      <AttivaPageInner />
    </Suspense>
  );
}

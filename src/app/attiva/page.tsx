'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandHero from '@/components/BrandHero';

export default function AttivaPage() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <BrandHero />
        <p className="mb-6 text-center text-sm text-neutral-500">Attiva il tuo account</p>
        <p className="mb-4 text-sm text-neutral-600">
          Inserisci la chiave di licenza che ti è stata fornita per attivare l&apos;abbonamento.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            className="min-h-24 rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
            placeholder="THM-....."
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
          >
            {loading ? 'Attivazione...' : 'Attiva'}
          </button>
        </form>
      </div>
    </div>
  );
}

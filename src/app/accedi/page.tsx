'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { oggiIso } from '@/lib/dateUtils';
import BrandHero from '@/components/BrandHero';

const REMEMBER_KEY = 'themis_remembered_email';

export default function AccediPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) setEmail(remembered);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError('Email o password errati.');
      return;
    }

    if (rememberMe) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);

    const { data: studio } = await supabase
      .from('studios')
      .select('plan, subscription_status, subscription_expires_at')
      .eq('id', data.user.id)
      .single();

    setLoading(false);

    if (!studio || studio.plan === null) {
      router.push('/attiva');
      return;
    }
    if (studio.subscription_status !== 'active') {
      setError('Abbonamento non attivo. Contatta lo studio per riattivarlo.');
      return;
    }
    if (studio.subscription_expires_at && studio.subscription_expires_at < oggiIso()) {
      setError(`Abbonamento scaduto il ${studio.subscription_expires_at}.`);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <BrandHero />
        <p className="mb-6 text-center text-sm text-neutral-500">Accedi con le credenziali del tuo studio</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Ricordami per il prossimo accesso
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
          >
            {loading ? 'Accesso...' : 'Entra'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Non hai ancora un account?{' '}
          <Link href="/registrati" className="text-bordeaux-700 hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}

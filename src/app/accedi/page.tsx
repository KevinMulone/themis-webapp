'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function AccediPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (studio.subscription_expires_at && studio.subscription_expires_at < new Date().toISOString().slice(0, 10)) {
      setError(`Abbonamento scaduto il ${studio.subscription_expires_at}.`);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">Themis</h1>
        <p className="mb-6 mt-1 text-sm text-neutral-500">Accedi con le credenziali del tuo studio</p>
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
          >
            {loading ? 'Accesso...' : 'Entra'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Non hai ancora un account?{' '}
          <Link href="/registrati" className="text-amber-800 hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}

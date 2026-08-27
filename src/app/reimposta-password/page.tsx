'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ReimpostaPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setError('Il link non è valido o è scaduto. Richiedine uno nuovo.'); }
      setReady(true);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La password deve avere almeno 8 caratteri.'); return; }
    if (password !== confirm) { setError('Le due password non coincidono.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.push('/accedi'), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">Themis</h1>
        <p className="mb-6 mt-1 text-sm text-neutral-500">Imposta una nuova password</p>

        {!ready ? (
          <p className="text-sm text-neutral-500">Caricamento...</p>
        ) : done ? (
          <p className="text-sm text-green-700">Password aggiornata. Ti reindirizziamo all&apos;accesso...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password" placeholder="Nuova password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="password" placeholder="Conferma password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="mt-2 rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
            >
              {loading ? 'Salvataggio...' : 'Imposta password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

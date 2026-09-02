'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { oggiIso } from '@/lib/dateUtils';
import BrandHero from '@/components/BrandHero';

const REMEMBER_KEY = 'themis_remembered_email';

export default function AccediClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalitaRecupero, setModalitaRecupero] = useState(false);
  const [recuperoEmail, setRecuperoEmail] = useState('');
  const [recuperoMsg, setRecuperoMsg] = useState('');
  const [recuperoLoading, setRecuperoLoading] = useState(false);

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

    // Stessa domanda del layout: non "la riga studios che sono io", ma "a
    // quale studio appartengo". Un collaboratore non ha una riga studios
    // propria e senza questo verrebbe mandato ad attivare una licenza.
    // Quando non si appartiene a nessuno studio la funzione non
    // restituisce righe, ed è il caso gestito qui sotto da !studio.
    const { data: contesto } = await supabase.rpc('contesto_studio').maybeSingle();
    const studio = contesto as {
      plan: string | null;
      subscription_status: string | null;
      subscription_expires_at: string | null;
    } | null;

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

  function apriRecupero() {
    setModalitaRecupero(true);
    setRecuperoEmail(email);
    setRecuperoMsg('');
  }

  async function handleRecupero(e: React.FormEvent) {
    e.preventDefault();
    setRecuperoMsg('');
    if (!recuperoEmail.trim()) return;
    setRecuperoLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(recuperoEmail.trim(), {
      redirectTo: `${window.location.origin}/reimposta-password`,
    });
    setRecuperoLoading(false);
    // Messaggio uguale a prescindere dal risultato: non conferma né smentisce
    // se quell'indirizzo è registrato, per non rivelare a chi non è
    // autorizzato quali email hanno un account.
    setRecuperoMsg("Se l'indirizzo è registrato, riceverai a breve un'email con le istruzioni per reimpostare la password.");
  }

  if (modalitaRecupero) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-sm rounded-xl bg-neutral-50 p-8">
          <BrandHero />
          <p className="mb-6 text-center text-sm text-neutral-500">Recupera la password</p>
          {recuperoMsg ? (
            <p className="text-sm text-green-700">{recuperoMsg}</p>
          ) : (
            <form onSubmit={handleRecupero} className="flex flex-col gap-3">
              <input
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                type="email"
                placeholder="La tua email"
                autoComplete="username"
                value={recuperoEmail}
                onChange={(e) => setRecuperoEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={recuperoLoading}
                className="mt-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                {recuperoLoading ? 'Invio...' : 'Invia il link per reimpostarla'}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-neutral-500">
            <button type="button" onClick={() => setModalitaRecupero(false)} className="text-bordeaux-700 hover:underline">
              Torna al login
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-neutral-50 p-8">
        <BrandHero />
        <p className="mb-6 text-center text-sm text-neutral-500">Accedi con le credenziali del tuo studio</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Ricordami
            </label>
            <button type="button" onClick={apriRecupero} className="text-sm text-bordeaux-700 hover:underline">
              Password dimenticata?
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
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

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
  const [mostraPassword, setMostraPassword] = useState(false);
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError('Email o password errati.');
      return;
    }

    if (rememberMe) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);

    const { data: contesto, error: contestoError } = await supabase.rpc('contesto_studio').maybeSingle();
    if (contestoError) {
      setLoading(false);
      setError('Accesso riuscito, ma non riesco a caricare lo studio. Riprova tra un momento.');
      return;
    }
    const studio = contesto as {
      plan: string | null;
      subscription_status: string | null;
      subscription_expires_at: string | null;
    } | null;

    setLoading(false);

    if (!studio || studio.plan === null) {
      router.push('/attiva');
      router.refresh();
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
    router.refresh();
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
    setRecuperoMsg("Se l'indirizzo è registrato, riceverai a breve un'email con le istruzioni per reimpostare la password.");
  }

  if (modalitaRecupero) {
    return (
      <div className="pagina-auth">
        <div className="scheda-auth entra">
          <BrandHero titolo="Recupera l'accesso" />
          <p className="mb-7 text-center text-[15px] text-neutral-500">Ti invieremo un link all&apos;email dello studio.</p>
          {recuperoMsg ? (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{recuperoMsg}</p>
          ) : (
            <form onSubmit={handleRecupero} className="flex flex-col gap-3">
              <input
                className="campo"
                type="email"
                placeholder="Email"
                autoComplete="username"
                value={recuperoEmail}
                onChange={(e) => setRecuperoEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={recuperoLoading}
                className="premi mt-2 rounded-full bg-neutral-900 py-3 text-[15px] font-medium text-white hover:bg-black disabled:opacity-50"
              >
                {recuperoLoading ? 'Invio...' : 'Invia il link'}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-neutral-500">
            <button type="button" onClick={() => setModalitaRecupero(false)} className="font-medium text-neutral-900 hover:underline">
              Torna al login
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pagina-auth">
      <div className="scheda-auth entra">
        <BrandHero titolo="Accedi" />
        <p className="mb-7 text-center text-[15px] text-neutral-500">Usa le credenziali del tuo studio.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="campo"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative">
            <input
              className="campo pr-16"
              type={mostraPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setMostraPassword((v) => !v)}
              className="absolute inset-y-0 right-0 px-4 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
              aria-label={mostraPassword ? 'Nascondi password' : 'Mostra password'}
            >
              {mostraPassword ? 'Nascondi' : 'Mostra'}
            </button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-[13px] text-neutral-600">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="accent-bordeaux-700" />
              Ricordami
            </label>
            <button type="button" onClick={apriRecupero} className="text-[13px] font-medium text-neutral-800 hover:underline">
              Password dimenticata?
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="premi mt-3 rounded-full bg-neutral-900 py-3 text-[15px] font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {loading ? 'Accesso...' : 'Entra'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-neutral-500">
          Non hai ancora un account?{' '}
          <Link href="/registrati" className="font-medium text-neutral-900 hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BrandHero from '@/components/BrandHero';

export default function ReimpostaPasswordClient() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let settled = false;
    const succeed = () => {
      if (settled) return;
      settled = true;
      setSessionReady(true);
      setChecking(false);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      setLinkFailed(true);
      setChecking(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) succeed();
    });

    (async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      if (hashParams.get('error_description')) { fail(); return; }

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) await supabase.auth.exchangeCodeForSession(code);

      // Il rilevamento del token dal link (hash o code) avviene in modo asincrono
      // dentro il client e i tempi variano; controlliamo a intervalli per qualche
      // secondo invece di arrenderci dopo un singolo timeout troppo corto.
      for (let i = 0; i < 15; i++) {
        if (settled) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { succeed(); return; }
        await new Promise((r) => setTimeout(r, 400));
      }
      fail();
    })();

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError('');
    if (!otpEmail || otpCode.length < 6) { setOtpError('Inserisci email e codice.'); return; }
    setVerifyingOtp(true);
    const { error: err } = await supabase.auth.verifyOtp({ email: otpEmail, token: otpCode, type: 'recovery' });
    setVerifyingOtp(false);
    if (err) { setOtpError('Codice errato o scaduto.'); return; }
    setSessionReady(true);
    setLinkFailed(false);
  }

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
      <div className="w-full max-w-sm rounded-xl bg-neutral-50 p-8">
        <BrandHero />
        <p className="mb-6 text-center text-sm text-neutral-500">Imposta una nuova password</p>

        {checking ? (
          <p className="text-sm text-neutral-500">Caricamento...</p>
        ) : done ? (
          <p className="text-sm text-green-700">Password aggiornata. Ti reindirizziamo all&apos;accesso...</p>
        ) : sessionReady ? (
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
              className="mt-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
            >
              {loading ? 'Salvataggio...' : 'Imposta password'}
            </button>
          </form>
        ) : (
          <>
            {linkFailed && (
              <p className="mb-3 text-sm text-red-600">
                Il link non è valido o è già stato usato (a volte il programma di posta lo apre da solo per controllarlo). Usa invece il codice ricevuto nella stessa email:
              </p>
            )}
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <input
                type="email" placeholder="La tua email" autoComplete="username"
                value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                type="text" inputMode="numeric" placeholder="Codice numerico dall'email"
                value={otpCode} onChange={(e) => setOtpCode(e.target.value.trim())}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              {otpError && <p className="text-sm text-red-600">{otpError}</p>}
              <button
                type="submit" disabled={verifyingOtp}
                className="mt-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                {verifyingOtp ? 'Verifica...' : 'Verifica codice'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

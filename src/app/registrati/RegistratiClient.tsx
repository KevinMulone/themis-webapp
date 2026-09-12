'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import BrandHero from '@/components/BrandHero';

export default function RegistratiClient({ registrazioneAbilitata }: { registrazioneAbilitata: boolean }) {
  const router = useRouter();
  const [nomeStudio, setNomeStudio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [consenso, setConsenso] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('email');
    if (q) setEmail(q);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!registrazioneAbilitata) {
      setError('Le nuove registrazioni sono temporaneamente sospese.');
      return;
    }
    if (!nomeStudio || !email || !password) {
      setError('Compila tutti i campi.');
      return;
    }
    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri.');
      return;
    }
    if (!consenso) {
      setError('Accetta l’informativa privacy e le condizioni del servizio.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome_studio: nomeStudio,
          condizioni_versione: '2026-09-12',
          privacy_versione: '2026-09-12',
          accettate_il: new Date().toISOString(),
        },
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? 'Questa email è già registrata. Prova ad accedere invece di registrarti.'
          : signUpError.message,
      );
      return;
    }
    if (!data.session) {
      setError("Registrazione inviata, ma serve confermare l'email prima di accedere. Controlla la posta.");
      return;
    }
    router.push('/attiva');
  }

  return (
    <div className="pagina-auth">
      <div className="scheda-auth entra">
        <BrandHero titolo="Crea lo studio" />
        <p className="mb-7 text-center text-[15px] text-neutral-500">Crea l&apos;account del tuo studio.</p>
        {!registrazioneAbilitata && (
          <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Le nuove registrazioni sono temporaneamente sospese mentre vengono completati i dati legali del servizio.
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-describedby={error ? 'errore-registrazione' : undefined}>
          <div>
            <label htmlFor="nome-studio" className="mb-1.5 block text-xs font-medium text-neutral-600">Nome dello studio</label>
            <input
              id="nome-studio"
              name="nome_studio"
              className="campo"
              placeholder="Es. Studio Legale Rossi"
              autoComplete="organization"
              required
              disabled={!registrazioneAbilitata}
              value={nomeStudio}
              onChange={(e) => setNomeStudio(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-neutral-600">Email di lavoro</label>
            <input
              id="email"
              name="email"
              className="campo"
              type="email"
              placeholder="nome@studio.it"
              autoComplete="username"
              required
              disabled={!registrazioneAbilitata}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-neutral-600">Password</label>
            <input
              id="password"
              name="password"
              className="campo"
              type="password"
              placeholder="Almeno 8 caratteri"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={!registrazioneAbilitata}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1.5 text-[11px] text-neutral-400">Usa una password unica, diversa da quella della PEC.</p>
          </div>
          <label className="mt-2 flex items-start gap-3 text-sm leading-relaxed text-neutral-600">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-neutral-900"
              checked={consenso}
              onChange={(e) => setConsenso(e.target.checked)}
              required
              disabled={!registrazioneAbilitata}
            />
            <span>
              Ho letto e accetto le <Link href="/condizioni" className="font-medium text-neutral-900 underline">condizioni del servizio</Link>
              {' '}e l’<Link href="/privacy" className="font-medium text-neutral-900 underline">informativa privacy</Link>.
            </span>
          </label>
          {error && <p id="errore-registrazione" role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !registrazioneAbilitata}
            className="premi mt-3 rounded-full bg-neutral-900 py-3 text-[15px] font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {loading ? 'Registrazione...' : 'Registrati'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-neutral-500">
          Hai già un account?{' '}
          <Link href="/accedi" className="font-medium text-neutral-900 hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}

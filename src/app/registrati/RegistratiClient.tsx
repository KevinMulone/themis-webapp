'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import BrandHero from '@/components/BrandHero';

export default function RegistratiClient() {
  const router = useRouter();
  const [nomeStudio, setNomeStudio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!nomeStudio || !email || !password) {
      setError('Compila tutti i campi.');
      return;
    }
    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome_studio: nomeStudio } },
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
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-neutral-50 p-8">
        <BrandHero />
        <p className="mb-6 text-center text-sm text-neutral-500">Crea l&apos;account del tuo studio</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            placeholder="Nome dello studio"
            value={nomeStudio}
            onChange={(e) => setNomeStudio(e.target.value)}
          />
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
            placeholder="Password (almeno 8 caratteri)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
          >
            {loading ? 'Registrazione...' : 'Registrati'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Hai già un account?{' '}
          <Link href="/accedi" className="text-bordeaux-700 hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}

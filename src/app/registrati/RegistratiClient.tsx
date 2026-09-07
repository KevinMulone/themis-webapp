'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('email');
    if (q) setEmail(q);
  }, []);

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
    <div className="pagina-auth">
      <div className="scheda-auth entra">
        <BrandHero titolo="Crea lo studio" />
        <p className="mb-7 text-center text-[15px] text-neutral-500">Crea l&apos;account del tuo studio.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="campo"
            placeholder="Nome dello studio"
            value={nomeStudio}
            onChange={(e) => setNomeStudio(e.target.value)}
          />
          <input
            className="campo"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="campo"
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

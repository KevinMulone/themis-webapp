'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BrandHero from '@/components/BrandHero';

type Invito = { valido: boolean; motivo?: string; email?: string; nome?: string | null; nomeStudio?: string | null };

export default function UniscitiClient() {
  const searchParams = useSearchParams();
  const codice = searchParams.get('invito');

  const [invito, setInvito] = useState<Invito | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    (async () => {
      if (!codice) { setInvito({ valido: false, motivo: 'Link non valido' }); setCaricando(false); return; }
      const res = await fetch(`/api/collaboratori/invito?codice=${encodeURIComponent(codice)}`);
      setInvito(await res.json());
      setCaricando(false);
    })();
  }, [codice]);

  async function handleAccetta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore('');
    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    if (password.length < 8) { setErrore('La password deve avere almeno 8 caratteri'); return; }

    setSalvando(true);
    const res = await fetch('/api/collaboratori/accetta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codice, nome: form.get('nome'), password }),
    });
    const body = await res.json();
    if (!res.ok) { setSalvando(false); setErrore(body.error || 'Non è stato possibile completare la registrazione'); return; }

    // L'account esiste: si entra subito, senza far ridigitare le credenziali.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: body.email, password });
    if (error) { setSalvando(false); setErrore('Account creato, ma l\'accesso non è riuscito. Vai alla pagina di accesso.'); return; }
    window.location.href = '/dashboard';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-neutral-50 p-8">
        <BrandHero />

        {caricando && <p className="text-center text-sm text-neutral-500">Caricamento...</p>}

        {!caricando && invito && !invito.valido && (
          <>
            <p className="mb-1 text-center font-semibold text-red-700">Invito non utilizzabile</p>
            <p className="text-center text-sm text-neutral-600">{invito.motivo}</p>
            <p className="mt-4 text-center text-sm text-neutral-500">
              Chiedi allo studio di generarti un nuovo link.
            </p>
          </>
        )}

        {!caricando && invito?.valido && (
          <>
            <p className="mb-1 text-center text-sm text-neutral-500">
              Sei stato invitato a collaborare con
            </p>
            <p className="mb-6 text-center font-semibold text-neutral-900">
              {invito.nomeStudio || 'uno studio su Themis'}
            </p>
            <p className="mb-4 text-sm text-neutral-600">
              Accederai con <strong>{invito.email}</strong>. Scegli una password.
            </p>
            <form onSubmit={handleAccetta} className="flex flex-col gap-3">
              <input
                name="nome" defaultValue={invito.nome || ''} placeholder="Il tuo nome e cognome"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                name="password" type="password" autoComplete="new-password"
                placeholder="Password (almeno 8 caratteri)"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              {errore && <p className="text-sm text-red-600">{errore}</p>}
              <button
                type="submit" disabled={salvando}
                className="mt-2 premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
              >
                {salvando ? 'Creazione account...' : 'Entra nello studio'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

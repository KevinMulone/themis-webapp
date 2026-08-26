import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from './logout-button';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/accedi');

  const { data: studio } = await supabase
    .from('studios')
    .select('nome_studio, plan, subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single();

  if (!studio || studio.plan === null) redirect('/attiva');

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Themis</h1>
          <p className="text-xs text-neutral-500">{studio.nome_studio}</p>
        </div>
        <LogoutButton />
      </header>
      <main className="p-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Fondamenta pronte</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Registrazione, attivazione con chiave e login funzionano. Piano:{' '}
            <strong>{studio.plan}</strong> — stato: <strong>{studio.subscription_status}</strong>
            {studio.subscription_expires_at && (
              <> — scadenza: <strong>{studio.subscription_expires_at}</strong></>
            )}
            . Clienti, pratiche, calendario e generazione documenti arrivano nella prossima fase.
          </p>
        </div>
      </main>
    </div>
  );
}

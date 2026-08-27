import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';
import { oggiIso } from '@/lib/dateUtils';

function giorniRimanenti(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - new Date(oggiIso()).getTime();
  const days = Math.round(diffMs / 86400000);
  if (days < 0) return 'scaduto';
  if (days === 0) return 'scade oggi';
  if (days === 1) return 'scade domani';
  return `scade tra ${days} giorni`;
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clienti', label: 'Clienti' },
  { href: '/pratiche', label: 'Pratiche' },
  { href: '/calendario', label: 'Calendario' },
  { href: '/genera', label: 'Genera Atto' },
  { href: '/calcolo-danno', label: 'Calcolo Danno' },
  { href: '/patrocinio', label: 'Patrocinio Stato' },
  { href: '/impostazioni', label: 'Impostazioni' },
];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/accedi');

  const { data: studio } = await supabase
    .from('studios')
    .select('nome_studio, plan, subscription_status, subscription_expires_at')
    .eq('id', user.id)
    .single();

  if (!studio || studio.plan === null) redirect('/attiva');

  const today = oggiIso();
  const expired = !!studio.subscription_expires_at && studio.subscription_expires_at < today;
  if (studio.subscription_status !== 'active' || expired) {
    redirect(`/account-sospeso?motivo=${expired ? 'scaduto' : 'sospeso'}`);
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-neutral-200 bg-white">
        <div className="border-b-2 border-gold-500 px-5 py-4">
          <h1 className="text-lg font-bold text-bordeaux-800">Themis</h1>
          <p className="text-xs text-neutral-500">{studio.nome_studio}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-gold-100 hover:text-bordeaux-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 p-3 text-center">
          {giorniRimanenti(studio.subscription_expires_at) && (
            <p className="mb-2 text-[11px] text-neutral-400">
              Abbonamento: {giorniRimanenti(studio.subscription_expires_at)}
            </p>
          )}
          <LogoutButton />
          <p className="mt-3 text-[10px] text-neutral-300">Created by Kevin M. D.</p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { oggiIso } from '@/lib/dateUtils';
import SidebarNav from './SidebarNav';

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
  { href: '/pec', label: 'PEC' },
  { href: '/genera', label: 'Genera Atto' },
  { href: '/calcolo-danno', label: 'Calcolo Danno' },
  { href: '/parcelle', label: 'Parcelle' },
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
    <div className="flex min-h-screen flex-col bg-neutral-50 lg:flex-row">
      <SidebarNav navItems={NAV} nomeStudio={studio.nome_studio} abbonamentoLabel={giorniRimanenti(studio.subscription_expires_at)} />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clienti', label: 'Clienti' },
  { href: '/pratiche', label: 'Pratiche' },
  { href: '/calendario', label: 'Calendario' },
];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/accedi');

  const { data: studio } = await supabase
    .from('studios')
    .select('nome_studio, plan, subscription_status')
    .eq('id', user.id)
    .single();

  if (!studio || studio.plan === null) redirect('/attiva');

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h1 className="text-lg font-bold text-neutral-900">Themis</h1>
          <p className="text-xs text-neutral-500">{studio.nome_studio}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

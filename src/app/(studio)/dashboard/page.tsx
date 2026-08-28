import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  // Il middleware ha già verificato la sessione con una vera chiamata di rete
  // per questa richiesta: getSession() legge il cookie già firmato, senza
  // rifare lo stesso giro di rete (vedi lo stesso ragionamento nel layout).
  const { data: { session } } = await supabase.auth.getSession();
  const user = session!.user;

  const [{ count: clientsCount }, { count: matterCount }] = await Promise.all([
    supabase.from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', user.id)
      .eq('archiviato', false),
    supabase.from('matters')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', user.id)
      .neq('stato', 'archiviata'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-display font-semibold text-neutral-900">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-bordeaux-700">{clientsCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Clienti</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-bordeaux-700">{matterCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Pratiche attive</div>
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <Image
          src="/themis-dashboard.svg"
          alt="Themis"
          width={400}
          height={480}
          className="w-full max-w-[280px]"
        />
      </div>
    </div>
  );
}

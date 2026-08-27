import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count: clientsCount } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('studio_id', user!.id)
    .eq('archiviato', false);

  const { count: matterCount } = await supabase
    .from('matters')
    .select('id', { count: 'exact', head: true })
    .eq('studio_id', user!.id)
    .neq('stato', 'archiviata');

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-amber-800">{clientsCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Clienti</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-amber-800">{matterCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Pratiche attive</div>
        </div>
      </div>
    </div>
  );
}

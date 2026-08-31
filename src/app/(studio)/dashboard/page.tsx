import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { contestoStudio } from '@/lib/studio/contesto';
import { oggiIso, addDaysIso } from '@/lib/dateUtils';
import { TIPI_EVENTO, TIPI_PRATICA, STATI_PRATICA, labelFromOptions, clientLabel, formatDateIt } from '@/lib/constants';

type ScadenzaRow = { id: string; titolo: string; tipo: string; data: string; ora_inizio: string | null };
type ClienteRef = { tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type PraticaRow = { id: string; tipo_pratica: string; stato: string; updated_at: string; clients: ClienteRef | ClienteRef[] | null };

function giorniA(dataIso: string, oggi: string): string {
  const diff = Math.round((new Date(dataIso).getTime() - new Date(oggi).getTime()) / 86400000);
  if (diff < 0) return `scaduta da ${Math.abs(diff)}gg`;
  if (diff === 0) return 'oggi';
  if (diff === 1) return 'domani';
  return `tra ${diff}gg`;
}

function primoCliente(c: ClienteRef | ClienteRef[] | null): ClienteRef | null {
  if (!c) return null;
  return Array.isArray(c) ? c[0] || null : c;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  // Il layout ha già verificato che il contesto esista (altrimenti avrebbe
  // reindirizzato), quindi qui non può essere nullo.
  const ctx = (await contestoStudio())!;
  const studioId = ctx.studioId;

  const oggi = oggiIso();
  const tra7gg = addDaysIso(oggi, 7);
  const tipiScadenza = ['udienza', 'termine_processuale', 'scadenza'];

  const [
    { count: clientsCount },
    { count: matterCount },
    { count: prossimeScadenzeCount },
    { count: prenotazioniInAttesaCount },
    { count: pecCount },
    { data: prossimeScadenze },
    { data: praticheRecenti },
  ] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('studio_id', studioId).eq('archiviato', false),
    supabase.from('matters').select('id', { count: 'exact', head: true }).eq('studio_id', studioId).neq('stato', 'archiviata'),
    supabase.from('eventi').select('id', { count: 'exact', head: true }).in('tipo', tipiScadenza).gte('data', oggi).lte('data', tra7gg),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('stato', 'in_attesa'),
    supabase.from('pec_messaggi').select('id', { count: 'exact', head: true }).eq('tipo_pec', 'posta-certificata'),
    supabase.from('eventi')
      .select('id, titolo, tipo, data, ora_inizio')
      .in('tipo', tipiScadenza)
      .gte('data', oggi)
      .order('data').order('ora_inizio')
      .limit(5),
    supabase.from('matters')
      .select('id, tipo_pratica, stato, updated_at, clients(tipo_soggetto, nome, cognome, ragione_sociale)')
      .eq('studio_id', studioId)
      .neq('stato', 'archiviata')
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  const scadenze = (prossimeScadenze || []) as ScadenzaRow[];
  const pratiche = (praticheRecenti || []) as unknown as PraticaRow[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-display font-semibold text-neutral-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-bordeaux-700">{clientsCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Clienti</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-bordeaux-700">{matterCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Pratiche attive</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-bordeaux-700">{prossimeScadenzeCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Udienze/termini (7gg)</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className={`text-3xl font-bold ${(prenotazioniInAttesaCount ?? 0) > 0 ? 'text-amber-600' : 'text-bordeaux-700'}`}>
            {prenotazioniInAttesaCount ?? 0}
          </div>
          <div className="text-sm text-neutral-500">Prenotazioni da confermare</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-bordeaux-700">{pecCount ?? 0}</div>
          <div className="text-sm text-neutral-500">Messaggi PEC</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-neutral-900">Prossime scadenze</h2>
          {scadenze.length === 0 ? (
            <p className="text-sm text-neutral-400">Nessuna udienza o termine in vista.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {scadenze.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium text-neutral-800">{ev.titolo}</div>
                    <div className="text-xs text-neutral-400">
                      {labelFromOptions(TIPI_EVENTO, ev.tipo)} · {formatDateIt(ev.data)}
                      {ev.ora_inizio && ` ${ev.ora_inizio.slice(0, 5)}`}
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                    {giorniA(ev.data, oggi)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-neutral-900">Pratiche recenti</h2>
          {pratiche.length === 0 ? (
            <p className="text-sm text-neutral-400">Nessuna pratica ancora.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {pratiche.map((m) => (
                <li key={m.id} className="py-2">
                  <Link href={`/pratiche/${m.id}`} className="block hover:text-bordeaux-700">
                    <div className="font-medium text-neutral-800">{clientLabel(primoCliente(m.clients) || undefined)}</div>
                    <div className="text-xs text-neutral-400">
                      {labelFromOptions(TIPI_PRATICA, m.tipo_pratica)} · {labelFromOptions(STATI_PRATICA, m.stato)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

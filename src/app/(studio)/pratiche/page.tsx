'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TIPI_PRATICA, STATI_PRATICA, labelFromOptions, clientLabel, formatDateIt } from '@/lib/constants';

type Client = { id: string; tipo_soggetto: string; nome: string | null; cognome: string | null; ragione_sociale: string | null };
type Matter = {
  id: string; client_id: string; tipo_pratica: string; stato: string; updated_at: string;
  clients?: Client;
};

export default function PraticheePage() {
  const supabase = createClient();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newTipo, setNewTipo] = useState('sinistro');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('matters')
      .select('*, clients(id, tipo_soggetto, nome, cognome, ragione_sociale)')
      .neq('stato', 'archiviata')
      .order('updated_at', { ascending: false });
    setMatters((data as Matter[]) || []);
    const { data: clientsData } = await supabase
      .from('clients').select('id, tipo_soggetto, nome, cognome, ragione_sociale')
      .eq('archiviato', false).order('cognome');
    setClients(clientsData || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientId) { alert('Seleziona un cliente'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('matters').insert({
      studio_id: user.id, client_id: newClientId, tipo_pratica: newTipo, stato: 'aperta',
    }).select('id').single();
    if (error) { alert(error.message); return; }
    if (newTipo === 'sinistro' && data) {
      await supabase.from('sinistri').insert({ studio_id: user.id, matter_id: data.id });
    }
    setCreating(false);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Pratiche</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900"
        >
          + Nuova pratica
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Caricamento...</p>
      ) : matters.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          Nessuna pratica trovata.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2">Aggiornata</th>
              </tr>
            </thead>
            <tbody>
              {matters.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/pratiche/${m.id}`} className="text-amber-800 hover:underline">
                      {clientLabel(m.clients)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{labelFromOptions(TIPI_PRATICA, m.tipo_pratica)}</td>
                  <td className="px-4 py-2">{labelFromOptions(STATI_PRATICA, m.stato)}</td>
                  <td className="px-4 py-2">{formatDateIt(m.updated_at?.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">Nuova pratica</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Cliente</label>
                <select
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleziona...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Tipo pratica</label>
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                >
                  {TIPI_PRATICA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="mt-2 flex justify-end gap-2 border-t border-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900"
                >
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

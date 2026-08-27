'use client';

import { useEffect, useState } from 'react';

type Studio = {
  id: string; nome_studio: string | null; email: string; plan: string | null;
  subscription_status: string; subscription_expires_at: string | null;
};

function addDays(base: string | null, days: number): string {
  const start = base && base > new Date().toISOString().slice(0, 10) ? new Date(base) : new Date();
  start.setDate(start.getDate() + days);
  return start.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) {
    setLog((l) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l]);
  }

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/studios');
    const body = await res.json();
    if (res.ok) setStudios(body.studios);
    else addLog(`Errore: ${body.error}`);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleExtend(s: Studio, days: number) {
    const newExpiry = addDays(s.subscription_expires_at, days);
    const res = await fetch(`/api/admin/studios/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_expires_at: newExpiry, subscription_status: 'active' }),
    });
    if (res.ok) { addLog(`${s.email}: esteso a +${days} giorni (nuova scadenza ${newExpiry}).`); load(); }
    else addLog(`Errore su ${s.email}`);
  }

  async function handleToggleStatus(s: Studio) {
    const newStatus = s.subscription_status === 'active' ? 'suspended' : 'active';
    const res = await fetch(`/api/admin/studios/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_status: newStatus }),
    });
    if (res.ok) { addLog(`${s.email}: ${newStatus === 'active' ? 'riattivato' : 'sospeso'}.`); load(); }
    else addLog(`Errore su ${s.email}`);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCreating(true);
    const res = await fetch('/api/admin/create-studio', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'), password: form.get('password'), nome_studio: form.get('nome_studio'),
        plan: form.get('plan'), days: Number(form.get('days')),
      }),
    });
    const body = await res.json();
    setCreating(false);
    if (res.ok) { addLog(`Studio creato: ${form.get('email')} (scadenza ${body.subscription_expires_at}).`); (e.target as HTMLFormElement).reset(); load(); }
    else addLog(`Errore creazione: ${body.error}`);
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-xl font-bold">Themis — Pannello abbonamenti</h1>
        <p className="mb-6 text-xs text-neutral-500">Uso esclusivo amministratore.</p>

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold">Nuovo studio</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <input name="nome_studio" placeholder="Nome studio" className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <input name="password" type="text" placeholder="Password iniziale" required className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <input name="plan" placeholder="Piano" defaultValue="monthly" className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <input name="days" type="number" placeholder="Giorni validità" defaultValue={30} className="col-span-2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <button type="submit" disabled={creating} className="col-span-2 rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold hover:bg-amber-800 disabled:opacity-50">
              {creating ? 'Creazione...' : 'Crea studio'}
            </button>
          </form>
        </div>

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold">Studi registrati ({studios.length})</h2>
          {loading ? <p className="text-sm text-neutral-500">Caricamento...</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-neutral-500">
                <tr><th className="pb-2">Studio</th><th>Email</th><th>Piano</th><th>Stato</th><th>Scadenza</th><th>Azioni</th></tr>
              </thead>
              <tbody>
                {studios.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-800">
                    <td className="py-2">{s.nome_studio || '—'}</td>
                    <td>{s.email}</td>
                    <td>{s.plan || '—'}</td>
                    <td className={s.subscription_status === 'active' ? 'text-green-400' : 'text-red-400'}>{s.subscription_status}</td>
                    <td>{s.subscription_expires_at || '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => handleExtend(s, 30)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">+30gg</button>
                        <button onClick={() => handleExtend(s, 90)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">+90gg</button>
                        <button onClick={() => handleExtend(s, 365)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">+365gg</button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`rounded px-2 py-0.5 text-xs ${s.subscription_status === 'active' ? 'bg-red-900 hover:bg-red-800' : 'bg-green-900 hover:bg-green-800'}`}
                        >
                          {s.subscription_status === 'active' ? 'Sospendi' : 'Riattiva'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold">Log</h2>
          <div className="max-h-32 overflow-y-auto text-xs text-neutral-500">
            {log.length === 0 ? 'Pronto.' : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

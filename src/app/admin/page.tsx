'use client';

import { useEffect, useState } from 'react';

type Studio = {
  id: string; nome_studio: string | null; email: string; plan: string | null;
  subscription_status: string; subscription_expires_at: string | null;
  last_sign_in_at: string | null;
};

function addDays(base: string | null, days: number): string {
  const start = base && base > new Date().toISOString().slice(0, 10) ? new Date(base) : new Date();
  start.setDate(start.getDate() + days);
  return start.toISOString().slice(0, 10);
}

function giorniRimanenti(expiresAt: string | null): string {
  if (!expiresAt) return '—';
  const diffMs = new Date(expiresAt).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  const days = Math.round(diffMs / 86400000);
  if (days < 0) return `scaduto da ${Math.abs(days)}gg`;
  if (days === 0) return 'scade oggi';
  return `${days}gg`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'mai';
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminPage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [otpResult, setOtpResult] = useState<{ email: string; otp: string } | null>(null);

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
    const verbo = days >= 0 ? `esteso a +${days}` : `ridotto di ${Math.abs(days)}`;
    if (res.ok) { addLog(`${s.email}: ${verbo} giorni (nuova scadenza ${newExpiry}).`); load(); }
    else addLog(`Errore su ${s.email}`);
  }

  async function handleSendResetPassword(s: Studio) {
    const res = await fetch(`/api/admin/studios/${s.id}/reset-password`, { method: 'POST' });
    const body = await res.json();
    if (res.ok) addLog(`Email di reimpostazione password inviata a ${body.email}.`);
    else addLog(`Errore invio reset a ${s.email}: ${body.error}`);
  }

  async function handleGenerateOtp(s: Studio) {
    const res = await fetch(`/api/admin/studios/${s.id}/generate-otp`, { method: 'POST' });
    const body = await res.json();
    if (res.ok) {
      setOtpResult({ email: body.email, otp: body.otp });
      addLog(`Codice di riserva generato per ${body.email}.`);
    } else {
      addLog(`Errore generazione codice per ${s.email}: ${body.error}`);
    }
  }

  async function handleSetStatus(s: Studio, newStatus: 'active' | 'suspended') {
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
            <button type="submit" disabled={creating} className="col-span-2 rounded-md bg-gold-600 px-4 py-2 text-sm font-semibold hover:bg-bordeaux-700 disabled:opacity-50">
              {creating ? 'Creazione...' : 'Crea studio'}
            </button>
          </form>
        </div>

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold">Studi registrati ({studios.length})</h2>
          {loading ? <p className="text-sm text-neutral-500">Caricamento...</p> : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Studio</th><th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Piano</th><th className="px-3 py-2">Stato</th>
                  <th className="px-3 py-2">Scadenza</th><th className="px-3 py-2">Ultimo accesso</th>
                  <th className="px-3 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {studios.map((s) => (
                  <tr key={s.id} className="border-t border-neutral-800 align-top">
                    <td className="px-3 py-3">{s.nome_studio || '—'}</td>
                    <td className="px-3 py-3">{s.email}</td>
                    <td className="px-3 py-3">{s.plan || '—'}</td>
                    <td className={`px-3 py-3 ${s.subscription_status === 'active' ? 'text-green-400' : 'text-red-400'}`}>{s.subscription_status}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {s.subscription_expires_at || '—'}
                      {s.subscription_expires_at && <span className="ml-1 text-neutral-500">({giorniRimanenti(s.subscription_expires_at)})</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-neutral-400">{formatDateTime(s.last_sign_in_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex w-max flex-col gap-1">
                        <div className="flex gap-1">
                          <button onClick={() => handleExtend(s, -365)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">-365gg</button>
                          <button onClick={() => handleExtend(s, -90)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">-90gg</button>
                          <button onClick={() => handleExtend(s, -30)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">-30gg</button>
                          <button onClick={() => handleExtend(s, 30)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">+30gg</button>
                          <button onClick={() => handleExtend(s, 90)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">+90gg</button>
                          <button onClick={() => handleExtend(s, 365)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">+365gg</button>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleSetStatus(s, 'suspended')} className="rounded bg-red-900 px-2 py-0.5 text-xs hover:bg-red-800">
                            Sospendi
                          </button>
                          <button onClick={() => handleSetStatus(s, 'active')} className="rounded bg-green-900 px-2 py-0.5 text-xs hover:bg-green-800">
                            Riattiva
                          </button>
                          <button onClick={() => handleSendResetPassword(s)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">
                            Invia reset password
                          </button>
                          <button onClick={() => handleGenerateOtp(s)} className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800">
                            Genera codice di riserva
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {otpResult && (
          <div className="mb-6 rounded-xl border border-gold-600 bg-bordeaux-950/40 p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Codice di riserva per {otpResult.email}</h2>
              <button onClick={() => setOtpResult(null)} className="text-xs text-neutral-400 hover:text-neutral-200">Chiudi</button>
            </div>
            <p className="mb-3 text-xs text-neutral-400">
              Comunica questo codice al cliente (telefono, WhatsApp, email personale): lo inserirà nella pagina
              &quot;Imposta una nuova password&quot; se il link ricevuto via email non funziona. Vale pochi minuti.
            </p>
            <p className="text-2xl font-mono font-bold tracking-widest text-gold-400">{otpResult.otp}</p>
          </div>
        )}

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

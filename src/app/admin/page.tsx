'use client';

import { useEffect, useState } from 'react';
import { addDaysIso, oggiIso } from '@/lib/dateUtils';
import { PLANS, type PlanKey } from '@/lib/stripe/plans';

type Studio = {
  id: string; nome_studio: string | null; email: string; plan: string | null;
  subscription_status: string; subscription_expires_at: string | null;
  last_sign_in_at: string | null; created_at: string;
  stripe_customer_id: string | null; refund_requested_at: string | null;
  tempo_utilizzo_secondi: number | null;
};

const PREZZO_MENSILE_EQUIVALENTE: Record<string, number> = {
  monthly: 100,
  semestrale: 500 / 6,
  annuale: 1100 / 12,
};

function giorniRimanenti(expiresAt: string | null): string {
  if (!expiresAt) return '—';
  const diffMs = new Date(expiresAt).getTime() - new Date(oggiIso()).getTime();
  const days = Math.round(diffMs / 86400000);
  if (days < 0) return `scaduto da ${Math.abs(days)}gg`;
  if (days === 0) return 'scade oggi';
  return `${days}gg`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'mai';
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formattaTempoUtilizzo(secondi: number | null): string {
  if (!secondi) return '—';
  const minuti = Math.floor(secondi / 60);
  const ore = Math.floor(minuti / 60);
  const giorni = Math.floor(ore / 24);
  if (giorni > 0) return `${giorni}g ${ore % 24}h`;
  if (ore > 0) return `${ore}h ${minuti % 60}m`;
  return `${minuti}m`;
}

export default function AdminPage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [otpResult, setOtpResult] = useState<{ email: string; otp: string } | null>(null);
  const [pianoNuovo, setPianoNuovo] = useState<PlanKey>('monthly');
  const [giorniNuovo, setGiorniNuovo] = useState<number>(PLANS.monthly.days);

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
    const newExpiry = addDaysIso(s.subscription_expires_at, days);
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

  async function handleRimborsoGestito(s: Studio) {
    const res = await fetch(`/api/admin/studios/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refund_requested_at: null }),
    });
    if (res.ok) { addLog(`${s.email}: richiesta di rimborso segnata come gestita.`); load(); }
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

  const totaleStudi = studios.length;
  const attivi = studios.filter((s) => s.subscription_status === 'active').length;
  const sospesi = studios.filter((s) => s.subscription_status === 'suspended').length;
  const inScadenza = studios.filter((s) => {
    if (!s.subscription_expires_at || s.subscription_status !== 'active') return false;
    const giorni = Math.round((new Date(s.subscription_expires_at).getTime() - new Date(oggiIso()).getTime()) / 86400000);
    return giorni >= 0 && giorni <= 7;
  }).length;
  const rimborsiInSospeso = studios.filter((s) => s.refund_requested_at);
  const mrrStimato = studios
    .filter((s) => s.subscription_status === 'active' && s.plan && PREZZO_MENSILE_EQUIVALENTE[s.plan])
    .reduce((tot, s) => tot + PREZZO_MENSILE_EQUIVALENTE[s.plan as string], 0);

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-xl font-bold">Themis — Pannello abbonamenti</h1>
        <p className="mb-6 text-xs text-neutral-500">Uso esclusivo amministratore.</p>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-bold">{totaleStudi}</div>
            <div className="text-xs text-neutral-500">Studi totali</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-green-400">{attivi}</div>
            <div className="text-xs text-neutral-500">Attivi</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-red-400">{sospesi}</div>
            <div className="text-xs text-neutral-500">Sospesi</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-gold-400">{inScadenza}</div>
            <div className="text-xs text-neutral-500">In scadenza (7gg)</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-bold">{mrrStimato.toFixed(0)}€</div>
            <div className="text-xs text-neutral-500">MRR stimato (solo Stripe)</div>
          </div>
        </div>

        {rimborsiInSospeso.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-6">
            <h2 className="mb-3 text-sm font-semibold text-red-300">
              Richieste di rimborso in sospeso ({rimborsiInSospeso.length})
            </h2>
            <ul className="space-y-2 text-sm">
              {rimborsiInSospeso.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <span>
                    {s.nome_studio || s.email} — richiesta il {formatDateTime(s.refund_requested_at)}
                  </span>
                  <button
                    onClick={() => handleRimborsoGestito(s)}
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                  >
                    Segna come gestita
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold">Nuovo studio</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="nome_studio" placeholder="Nome studio" className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <input name="email" type="email" placeholder="Email" required className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <input name="password" type="text" placeholder="Password iniziale" required className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
            <select
              name="plan"
              value={pianoNuovo}
              onChange={(e) => {
                const piano = e.target.value as PlanKey;
                setPianoNuovo(piano);
                setGiorniNuovo(PLANS[piano].days);
              }}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            >
              {(Object.keys(PLANS) as PlanKey[]).map((k) => (
                <option key={k} value={k}>{PLANS[k].label}</option>
              ))}
            </select>
            <select
              name="days"
              value={giorniNuovo}
              onChange={(e) => setGiorniNuovo(Number(e.target.value))}
              className="col-span-2 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            >
              <option value={30}>30 giorni (mensile)</option>
              <option value={180}>180 giorni (semestrale)</option>
              <option value={365}>365 giorni (annuale)</option>
            </select>
            <button type="submit" disabled={creating} className="col-span-2 rounded-md bg-gold-600 px-4 py-2 text-sm font-semibold hover:bg-bordeaux-700 disabled:opacity-50">
              {creating ? 'Creazione...' : 'Crea studio'}
            </button>
          </form>
        </div>

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-3 text-sm font-semibold">Studi registrati ({studios.length})</h2>
          {loading ? <p className="text-sm text-neutral-500">Caricamento...</p> : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Studio</th><th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Piano</th><th className="px-3 py-2">Stato</th>
                  <th className="px-3 py-2">Scadenza</th><th className="px-3 py-2">Ultimo accesso</th>
                  <th className="px-3 py-2">Tempo d&apos;uso</th>
                  <th className="px-3 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {studios.map((s) => (
                  <tr key={s.id} className={`border-t border-neutral-800 align-top ${s.refund_requested_at ? 'bg-red-950/20' : ''}`}>
                    <td className="px-3 py-3">
                      {s.nome_studio || '—'}
                      {s.stripe_customer_id && (
                        <span className="ml-1 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">Stripe</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{s.email}</td>
                    <td className="px-3 py-3">{s.plan || '—'}</td>
                    <td className={`px-3 py-3 ${s.subscription_status === 'active' ? 'text-green-400' : 'text-red-400'}`}>{s.subscription_status}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {s.subscription_expires_at || '—'}
                      {s.subscription_expires_at && <span className="ml-1 text-neutral-500">({giorniRimanenti(s.subscription_expires_at)})</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-neutral-400">{formatDateTime(s.last_sign_in_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-neutral-400">{formattaTempoUtilizzo(s.tempo_utilizzo_secondi)}</td>
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

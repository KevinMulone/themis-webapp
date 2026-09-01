'use client';

import { useEffect, useState } from 'react';
import { addDaysIso, oggiIso } from '@/lib/dateUtils';
import { PLANS, isPlanKey, type PlanKey } from '@/lib/stripe/plans';

type ConsumoStudio = {
  studioId: string; nome: string; plan: string | null;
  meseMillesimi: number; meseRichieste: number;
  totaleMillesimi: number; totaleRichieste: number;
};

/** Millesimi di dollaro → «1,20 $». */
function usd(millesimi: number): string {
  return `${(millesimi / 1000).toFixed(2).replace('.', ',')} $`;
}

type Studio = {
  id: string; nome_studio: string | null; email: string; plan: string | null;
  subscription_status: string; subscription_expires_at: string | null;
  last_sign_in_at: string | null; created_at: string;
  stripe_customer_id: string | null; refund_requested_at: string | null;
  tempo_utilizzo_secondi: number | null;
};

// Di quanto si può spostare la scadenza con un clic. Aggiungere o togliere
// un valore qui è l'unica modifica necessaria.
const SCATTI_GIORNI = [-365, -90, -30, -1, 1, 30, 90, 365];

// Durate offerte alla generazione delle chiavi. Il piano suggerito
// determina anche i posti collaboratore, quindi resta modificabile a parte.
const DURATE_CHIAVE: { giorni: number; label: string; plan: PlanKey }[] = [
  { giorni: 1, label: '1 giorno (prova)', plan: 'monthly' },
  { giorni: 7, label: '7 giorni (prova)', plan: 'monthly' },
  { giorni: 30, label: '30 giorni', plan: 'monthly' },
  { giorni: 180, label: '6 mesi', plan: 'semestrale' },
  { giorni: 365, label: '1 anno', plan: 'annuale' },
];

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
  const [limiti, setLimiti] = useState<Record<string, number>>({});
  const [consumoMese, setConsumoMese] = useState<{ totaleMillesimi: number; studiAttivi: number; richieste: number } | null>(null);
  const [consumoTotale, setConsumoTotale] = useState<{ totaleMillesimi: number; richieste: number; studi: number } | null>(null);
  const [consumoPerStudio, setConsumoPerStudio] = useState<ConsumoStudio[]>([]);
  const [salvandoLimiti, setSalvandoLimiti] = useState(false);
  const [limitiSalvati, setLimitiSalvati] = useState(false);
  const [durataChiave, setDurataChiave] = useState(30);
  const [pianoChiave, setPianoChiave] = useState<PlanKey>('monthly');
  const [chiaveGenerata, setChiaveGenerata] = useState<string | null>(null);
  const [generandoChiave, setGenerandoChiave] = useState(false);
  const [chiaveCopiata, setChiaveCopiata] = useState(false);
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

  async function loadLimiti() {
    const res = await fetch('/api/admin/limiti-assistente');
    if (!res.ok) return;
    const body = await res.json();
    const mappa: Record<string, number> = {};
    for (const l of body.limiti || []) mappa[l.plan] = l.credito_cent;
    setLimiti(mappa);
    setConsumoMese(body.consumoMese || null);
    setConsumoTotale(body.consumoTotale || null);
    setConsumoPerStudio(body.perStudio || []);
  }

  async function salvaLimite(plan: string, creditoCent: number) {
    const res = await fetch('/api/admin/limiti-assistente', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, creditoCent }),
    });
    if (res.ok) addLog(`Limite assistente ${plan}: ${(creditoCent / 100).toFixed(2)} $/mese.`);
    else { const b = await res.json(); addLog(`Errore limite ${plan}: ${b.error}`); }
  }

  /**
   * Salva tutti i piani insieme.
   *
   * I cursori salvavano già da soli al rilascio, ma senza dirlo: si
   * restava col dubbio di aver spostato senza confermare. Il pulsante non
   * aggiunge una funzione, aggiunge la certezza di averla usata.
   */
  async function salvaTuttiILimiti() {
    setSalvandoLimiti(true);
    setLimitiSalvati(false);
    const piani = Object.keys(PLANS) as PlanKey[];
    const esiti = await Promise.all(piani.map(async (k) => {
      const res = await fetch('/api/admin/limiti-assistente', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: k, creditoCent: limiti[k] ?? 0 }),
      });
      if (!res.ok) { const b = await res.json(); addLog(`Errore limite ${k}: ${b.error}`); }
      return res.ok;
    }));
    setSalvandoLimiti(false);
    if (esiti.every(Boolean)) {
      addLog(`Limiti salvati: ${piani.map((k) => `${PLANS[k].label} ${((limiti[k] ?? 0) / 100).toFixed(2)} $`).join(' · ')}`);
      setLimitiSalvati(true);
      setTimeout(() => setLimitiSalvati(false), 3000);
    }
    loadLimiti();
  }

  useEffect(() => { load(); loadLimiti(); }, []);

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

  async function handleElimina(s: Studio) {
    const ok = confirm(
      `Eliminare definitivamente lo studio "${s.nome_studio || s.email}"?\n\n` +
      `Questa azione è IRREVERSIBILE: l'account di accesso e la sua riga verranno cancellati subito. ` +
      `Eventuali documenti caricati nello storage potrebbero restare orfani (non più raggiungibili da nessuna interfaccia, ma non cancellati automaticamente).`,
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/studios/${s.id}`, { method: 'DELETE' });
    if (res.ok) { addLog(`${s.email}: studio eliminato definitivamente.`); load(); }
    else { const body = await res.json(); addLog(`Errore eliminazione ${s.email}: ${body.error}`); }
  }

  async function handleGeneraChiave() {
    setGenerandoChiave(true);
    setChiaveGenerata(null);
    const res = await fetch('/api/admin/licenze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giorni: durataChiave, plan: pianoChiave }),
    });
    const body = await res.json();
    setGenerandoChiave(false);
    if (!res.ok) { addLog(`Errore generazione chiave: ${body.error}`); return; }
    setChiaveGenerata(body.key);
    setChiaveCopiata(false);
    addLog(`Chiave generata: ${durataChiave} giorni, piano ${pianoChiave}.`);
  }

  async function handleCopiaChiave() {
    if (!chiaveGenerata) return;
    try {
      await navigator.clipboard.writeText(chiaveGenerata);
      setChiaveCopiata(true);
    } catch {
      addLog('Copia non riuscita: seleziona e copia la chiave a mano.');
    }
  }

  async function handleCambiaPiano(s: Studio, plan: string) {
    const res = await fetch(`/api/admin/studios/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    if (res.ok) { addLog(`${s.email}: piano impostato su ${plan}.`); load(); }
    else addLog(`Errore cambio piano su ${s.email}`);
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
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Limite mensile assistente</h2>
            {consumoMese && consumoTotale && (
              <span className="text-xs text-neutral-500">
                Questo mese {usd(consumoMese.totaleMillesimi)} ({consumoMese.richieste} richieste,{' '}
                {consumoMese.studiAttivi} studi) · Da sempre {usd(consumoTotale.totaleMillesimi)}
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-neutral-500">
            Quanto può spendere ogni studio al mese, per piano, <strong>in dollari</strong> —
            la valuta in cui Anthropic fattura e in cui ricarichi il credito. È il tuo margine:
            quando lo studio lo esaurisce la funzione si ferma con un avviso, fino al mese
            successivo.
          </p>
          <div className="space-y-4">
            {(Object.keys(PLANS) as PlanKey[]).map((k) => {
              const valore = limiti[k] ?? 0;
              return (
                <div key={k} className="flex flex-wrap items-center gap-3">
                  <span className="w-24 text-xs text-neutral-400">{PLANS[k].label}</span>
                  <input
                    type="range" min={0} max={5000} step={50}
                    value={valore}
                    onChange={(e) => setLimiti({ ...limiti, [k]: Number(e.target.value) })}
                    onMouseUp={(e) => salvaLimite(k, Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={(e) => salvaLimite(k, Number((e.target as HTMLInputElement).value))}
                    className="h-1 flex-1 min-w-40 cursor-pointer accent-gold-600"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={100000} step={50}
                      value={valore}
                      onChange={(e) => setLimiti({ ...limiti, [k]: Number(e.target.value) })}
                      onBlur={(e) => salvaLimite(k, Number(e.target.value))}
                      className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-right text-xs"
                    />
                    <span className="text-xs text-neutral-500">cent</span>
                    <span className="w-16 text-right text-xs text-neutral-400">
                      {(valore / 100).toFixed(2).replace('.', ',')} $
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            {limitiSalvati && <span className="text-xs text-green-500">Salvato</span>}
            <button
              type="button" onClick={salvaTuttiILimiti} disabled={salvandoLimiti}
              className="rounded-md bg-gold-600 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-gold-500 disabled:opacity-50"
            >
              {salvandoLimiti ? 'Salvataggio...' : 'Salva i limiti'}
            </button>
          </div>

          <div className="mt-6 border-t border-neutral-800 pt-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-neutral-300">Consumo per abbonato</h3>
              {consumoTotale && consumoTotale.studi > 0 && (
                <span className="text-xs text-neutral-500">
                  {consumoTotale.studi} studi · {consumoTotale.richieste} richieste in totale
                </span>
              )}
            </div>

            {consumoPerStudio.length === 0 ? (
              <p className="text-xs text-neutral-600">Nessun consumo registrato finora.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500">
                      <th className="py-1.5 text-left font-medium">Studio</th>
                      <th className="py-1.5 text-left font-medium">Piano</th>
                      <th className="py-1.5 text-right font-medium">Questo mese</th>
                      <th className="py-1.5 text-right font-medium">Da sempre</th>
                      <th className="py-1.5 text-right font-medium">Richieste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumoPerStudio.map((c) => {
                      const tetto = c.plan ? (limiti[c.plan] ?? 0) * 10 : 0;
                      // Chi è vicino al tetto va visto a colpo d'occhio: è
                      // lo studio che fra poco si vedrà bloccare la funzione,
                      // e quindi quello che potrebbe chiamarti.
                      const quota = tetto > 0 ? c.meseMillesimi / tetto : 0;
                      return (
                        <tr key={c.studioId} className="border-b border-neutral-900">
                          <td className="py-1.5 pr-2 text-neutral-300">{c.nome}</td>
                          <td className="py-1.5 pr-2 text-neutral-500">
                            {c.plan && isPlanKey(c.plan) ? PLANS[c.plan].label : c.plan || '—'}
                          </td>
                          <td className={`py-1.5 text-right tabular-nums ${
                            quota >= 1 ? 'font-semibold text-red-400'
                              : quota >= 0.8 ? 'text-gold-500' : 'text-neutral-300'
                          }`}>
                            {usd(c.meseMillesimi)}
                            {tetto > 0 && <span className="text-neutral-600"> / {usd(tetto)}</span>}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-neutral-400">
                            {usd(c.totaleMillesimi)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-neutral-500">
                            {c.totaleRichieste}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {consumoTotale && (
                    <tfoot>
                      <tr className="text-neutral-200">
                        <td className="py-2 font-semibold" colSpan={2}>Totale</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {consumoMese ? usd(consumoMese.totaleMillesimi) : '—'}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {usd(consumoTotale.totaleMillesimi)}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {consumoTotale.richieste}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            <p className="mt-2 text-[11px] text-neutral-600">
              «Da sempre» è quanto hai speso in tutto per quello studio: confrontalo con
              l&apos;abbonamento che paga, non con il tetto mensile.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-1 text-sm font-semibold">Genera chiave di licenza</h2>
          <p className="mb-3 text-xs text-neutral-500">
            La durata parte dalla prima attivazione, non da adesso: una chiave consegnata oggi e
            usata fra due settimane vale comunque tutti i giorni previsti.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Durata</label>
              <select
                value={durataChiave}
                onChange={(e) => {
                  const g = Number(e.target.value);
                  setDurataChiave(g);
                  const preset = DURATE_CHIAVE.find((d) => d.giorni === g);
                  if (preset) setPianoChiave(preset.plan);
                }}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              >
                {DURATE_CHIAVE.map((d) => (
                  <option key={d.giorni} value={d.giorni}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Piano (determina i posti collaboratore)</label>
              <select
                value={pianoChiave}
                onChange={(e) => setPianoChiave(e.target.value as PlanKey)}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              >
                {(Object.keys(PLANS) as PlanKey[]).map((k) => (
                  <option key={k} value={k}>{PLANS[k].label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGeneraChiave} disabled={generandoChiave}
              className="rounded-md bg-gold-600 px-4 py-2 text-sm font-semibold hover:bg-bordeaux-700 disabled:opacity-50"
            >
              {generandoChiave ? 'Generazione...' : 'Genera chiave'}
            </button>
          </div>

          {chiaveGenerata && (
            <div className="mt-4 border-t border-neutral-800 pt-4">
              <p className="mb-2 text-xs text-neutral-400">Consegnala al cliente: si attiva una volta sola.</p>
              <textarea
                readOnly value={chiaveGenerata} onFocus={(e) => e.currentTarget.select()}
                className="mb-2 min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs"
              />
              <button
                onClick={handleCopiaChiave}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
              >
                {chiaveCopiata ? 'Copiata!' : 'Copia chiave'}
              </button>
            </div>
          )}
        </div>

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
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleElimina(s)}
                          title="Elimina definitivamente questo studio"
                          className="flex h-4 w-4 items-center justify-center rounded-full border border-neutral-700 text-[10px] leading-none text-neutral-500 hover:border-red-500 hover:text-red-400"
                        >
                          ×
                        </button>
                        {s.nome_studio || '—'}
                        {s.stripe_customer_id && (
                          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">Stripe</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3">{s.email}</td>
                    <td className="px-3 py-3">
                      <select
                        value={(Object.keys(PLANS) as string[]).includes(s.plan || '') ? (s.plan as string) : ''}
                        onChange={(e) => handleCambiaPiano(s, e.target.value)}
                        className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-xs"
                      >
                        {/* Piani storici o personalizzati: mostrati ma non selezionabili,
                            perché non danno diritto a posti collaboratore. */}
                        {!(Object.keys(PLANS) as string[]).includes(s.plan || '') && (
                          <option value="">{s.plan || '—'}</option>
                        )}
                        {(Object.keys(PLANS) as PlanKey[]).map((k) => (
                          <option key={k} value={k}>{PLANS[k].label}</option>
                        ))}
                      </select>
                    </td>
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
                          {SCATTI_GIORNI.map((g) => (
                            <button
                              key={g}
                              onClick={() => handleExtend(s, g)}
                              className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
                            >
                              {g > 0 ? `+${g}` : g}gg
                            </button>
                          ))}
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

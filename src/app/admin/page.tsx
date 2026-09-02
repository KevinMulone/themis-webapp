'use client';

import { useEffect, useState } from 'react';
import { addDaysIso, oggiIso } from '@/lib/dateUtils';
import { PLANS, isPlanKey, type PlanKey } from '@/lib/stripe/plans';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';

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

/**
 * Le cinque tessere in cima: un numero grande, un'etichetta piccola.
 *
 * Le classi colore sono scritte per intero, una per variante, apposta:
 * Tailwind decide cosa includere nel foglio di stile leggendo il
 * sorgente alla ricerca di stringhe letterali. Una classe composta a
 * runtime come `text-${tono}` non viene mai vista, e il colore
 * risulterebbe assente dal sito pubblicato pur essendo corretto nel
 * codice.
 */
const TONO_KPI = {
  neutro: 'text-neutral-900',
  successo: 'text-green-600',
  pericolo: 'text-red-600',
  avviso: 'text-gold-600',
} as const;

function Kpi({ valore, etichetta, tono = 'neutro' }: {
  valore: React.ReactNode; etichetta: string; tono?: keyof typeof TONO_KPI;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <div className={`text-2xl font-bold ${TONO_KPI[tono]}`}>{valore}</div>
      <div className="text-xs text-neutral-500">{etichetta}</div>
    </div>
  );
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
  const [erroreLimiti, setErroreLimiti] = useState('');
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
    // Se il server non ha la riga di un piano, si TIENE il valore già sullo
    // schermo invece di azzerarlo. Un cursore che torna a zero da solo fa
    // credere di aver perso il lavoro, e nasconde il vero problema — che è
    // la riga mancante, non il salvataggio.
    setLimiti((precedenti) => ({ ...precedenti, ...mappa }));
    if ((body.limiti || []).length === 0) {
      setErroreLimiti('Il database non ha ancora i limiti per nessun piano: esegui la migrazione 013.');
    }
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
    setErroreLimiti('');
    const esiti = await Promise.all(piani.map(async (k) => {
      const res = await fetch('/api/admin/limiti-assistente', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: k, creditoCent: limiti[k] ?? 0 }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        addLog(`Errore limite ${k}: ${b.error}`);
        setErroreLimiti(`${PLANS[k].label}: ${b.error}`);
      }
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
    // Una sola striscia oro in cima distingue "sei nell'amministrazione"
    // da qualunque altra pagina — non un secondo tema visivo intero.
    // Il resto usa lo stesso sfondo, le stesse schede bianche, gli stessi
    // bottoni di tutta l'app: chi passa dal pannello utente a questo non
    // deve reimparare a leggere lo schermo.
    <div className="min-h-screen bg-neutral-50">
      <div className="h-1.5 bg-gold-500" />
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-1 text-xl font-bold text-neutral-900">Themis — Pannello abbonamenti</h1>
        <p className="mb-6 text-xs text-neutral-500">Uso esclusivo amministratore.</p>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi valore={totaleStudi} etichetta="Studi totali" />
          <Kpi valore={attivi} etichetta="Attivi" tono="successo" />
          <Kpi valore={sospesi} etichetta="Sospesi" tono="pericolo" />
          <Kpi valore={inScadenza} etichetta="In scadenza (7gg)" tono="avviso" />
          <Kpi valore={`${mrrStimato.toFixed(0)}€`} etichetta="MRR stimato (solo Stripe)" />
        </div>

        {rimborsiInSospeso.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <h2 className="mb-3 text-sm font-semibold text-red-800">
              Richieste di rimborso in sospeso ({rimborsiInSospeso.length})
            </h2>
            <ul className="space-y-2 text-sm text-neutral-800">
              {rimborsiInSospeso.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <span>
                    {s.nome_studio || s.email} — richiesta il {formatDateTime(s.refund_requested_at)}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => handleRimborsoGestito(s)}>
                    Segna come gestita
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Limite mensile assistente</h2>
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
                  <span className="w-24 text-xs text-neutral-500">{PLANS[k].label}</span>
                  <input
                    type="range" min={0} max={5000} step={50}
                    value={valore}
                    onChange={(e) => setLimiti({ ...limiti, [k]: Number(e.target.value) })}
                    onMouseUp={(e) => salvaLimite(k, Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={(e) => salvaLimite(k, Number((e.target as HTMLInputElement).value))}
                    className="h-1 flex-1 min-w-40 cursor-pointer accent-bordeaux-700"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={100000} step={50}
                      value={valore}
                      onChange={(e) => setLimiti({ ...limiti, [k]: Number(e.target.value) })}
                      onBlur={(e) => salvaLimite(k, Number(e.target.value))}
                      className="w-20 rounded-lg border border-transparent bg-neutral-50 px-2 py-1 text-right text-xs outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                    />
                    <span className="text-xs text-neutral-500">cent</span>
                    <span className="w-16 text-right text-xs text-neutral-500">
                      {(valore / 100).toFixed(2).replace('.', ',')} $
                    </span>
                    {/* Zero è un valore legittimo — "niente Themis per questo
                        piano" — ma è anche il valore che si ottiene per
                        sbaglio. Detto a voce alta smette di essere una
                        trappola silenziosa. */}
                    {valore === 0 && <Badge tono="danger">Themis disattivato</Badge>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            {erroreLimiti && <span className="text-xs text-red-600">{erroreLimiti}</span>}
            {limitiSalvati && !erroreLimiti && <span className="text-xs text-green-600">Salvato</span>}
            <Button onClick={salvaTuttiILimiti} disabled={salvandoLimiti} size="sm">
              {salvandoLimiti ? 'Salvataggio...' : 'Salva i limiti'}
            </Button>
          </div>

          <div className="mt-6 border-t border-neutral-100 pt-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-neutral-700">Consumo per abbonato</h3>
              {consumoTotale && consumoTotale.studi > 0 && (
                <span className="text-xs text-neutral-500">
                  {consumoTotale.studi} studi · {consumoTotale.richieste} richieste in totale
                </span>
              )}
            </div>

            {consumoPerStudio.length === 0 ? (
              <p className="text-xs text-neutral-400">Nessun consumo registrato finora.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500">
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
                        <tr key={c.studioId} className="border-b border-neutral-100">
                          <td className="py-1.5 pr-2 text-neutral-700">{c.nome}</td>
                          <td className="py-1.5 pr-2 text-neutral-500">
                            {c.plan && isPlanKey(c.plan) ? PLANS[c.plan].label : c.plan || '—'}
                          </td>
                          <td className={`py-1.5 text-right tabular-nums ${
                            quota >= 1 ? 'font-semibold text-red-600'
                              : quota >= 0.8 ? 'text-gold-600' : 'text-neutral-700'
                          }`}>
                            {usd(c.meseMillesimi)}
                            {tetto > 0 && (
                              <span className="text-neutral-400">
                                {' / '}{usd(tetto)} · {Math.round(quota * 100)}%
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-neutral-500">
                            {usd(c.totaleMillesimi)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-neutral-400">
                            {c.totaleRichieste}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {consumoTotale && (
                    <tfoot>
                      <tr className="text-neutral-800">
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

            <p className="mt-2 text-[11px] text-neutral-500">
              «Da sempre» è quanto hai speso in tutto per quello studio: confrontalo con
              l&apos;abbonamento che paga, non con il tetto mensile.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Genera chiave di licenza"
            hint="La durata parte dalla prima attivazione, non da adesso: una chiave consegnata oggi e usata fra due settimane vale comunque tutti i giorni previsti."
          />
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Durata"
              value={durataChiave}
              onChange={(e) => {
                const g = Number(e.target.value);
                setDurataChiave(g);
                const preset = DURATE_CHIAVE.find((d) => d.giorni === g);
                if (preset) setPianoChiave(preset.plan);
              }}
            >
              {DURATE_CHIAVE.map((d) => (
                <option key={d.giorni} value={d.giorni}>{d.label}</option>
              ))}
            </Select>
            <Select
              label="Piano (determina i posti collaboratore)"
              value={pianoChiave}
              onChange={(e) => setPianoChiave(e.target.value as PlanKey)}
            >
              {(Object.keys(PLANS) as PlanKey[]).map((k) => (
                <option key={k} value={k}>{PLANS[k].label}</option>
              ))}
            </Select>
            <Button onClick={handleGeneraChiave} disabled={generandoChiave}>
              {generandoChiave ? 'Generazione...' : 'Genera chiave'}
            </Button>
          </div>

          {chiaveGenerata && (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <p className="mb-2 text-xs text-neutral-500">Consegnala al cliente: si attiva una volta sola.</p>
              <textarea
                readOnly value={chiaveGenerata} onFocus={(e) => e.currentTarget.select()}
                className="mb-2 min-h-20 w-full rounded-lg border border-transparent bg-neutral-50 px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              />
              <Button variant="secondary" size="sm" onClick={handleCopiaChiave}>
                {chiaveCopiata ? 'Copiata!' : 'Copia chiave'}
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Nuovo studio</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field name="nome_studio" label="Nome studio" placeholder="Nome studio" />
            <Field name="email" type="email" label="Email" placeholder="Email" required />
            <Field name="password" type="text" label="Password iniziale" placeholder="Password iniziale" required />
            <Select
              name="plan"
              label="Piano"
              value={pianoNuovo}
              onChange={(e) => {
                const piano = e.target.value as PlanKey;
                setPianoNuovo(piano);
                setGiorniNuovo(PLANS[piano].days);
              }}
            >
              {(Object.keys(PLANS) as PlanKey[]).map((k) => (
                <option key={k} value={k}>{PLANS[k].label}</option>
              ))}
            </Select>
            <Select
              name="days"
              label="Durata"
              full
              value={giorniNuovo}
              onChange={(e) => setGiorniNuovo(Number(e.target.value))}
            >
              <option value={30}>30 giorni (mensile)</option>
              <option value={180}>180 giorni (semestrale)</option>
              <option value={365}>365 giorni (annuale)</option>
            </Select>
            <Button type="submit" disabled={creating} className="col-span-full">
              {creating ? 'Creazione...' : 'Crea studio'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Studi registrati ({studios.length})</h2>
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
                  <tr key={s.id} className={`border-t border-neutral-100 align-top ${s.refund_requested_at ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-neutral-900">
                        <button
                          onClick={() => handleElimina(s)}
                          title="Elimina definitivamente questo studio"
                          className="premi flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-[10px] leading-none text-neutral-400 hover:bg-red-100 hover:text-red-600"
                        >
                          ×
                        </button>
                        {s.nome_studio || '—'}
                        {s.stripe_customer_id && <Badge>Stripe</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-neutral-700">{s.email}</td>
                    <td className="px-3 py-3">
                      <select
                        value={(Object.keys(PLANS) as string[]).includes(s.plan || '') ? (s.plan as string) : ''}
                        onChange={(e) => handleCambiaPiano(s, e.target.value)}
                        className="rounded border border-transparent bg-neutral-50 px-1.5 py-0.5 text-xs outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
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
                    <td className="px-3 py-3">
                      <Badge tono={s.subscription_status === 'active' ? 'success' : 'danger'}>
                        {s.subscription_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-neutral-700">
                      {s.subscription_expires_at || '—'}
                      {s.subscription_expires_at && <span className="ml-1 text-neutral-400">({giorniRimanenti(s.subscription_expires_at)})</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-neutral-500">{formatDateTime(s.last_sign_in_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-neutral-500">{formattaTempoUtilizzo(s.tempo_utilizzo_secondi)}</td>
                    <td className="px-3 py-3">
                      <div className="flex w-max flex-col gap-1">
                        <div className="flex gap-1">
                          {SCATTI_GIORNI.map((g) => (
                            <button
                              key={g}
                              onClick={() => handleExtend(s, g)}
                              className="premi rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-200"
                            >
                              {g > 0 ? `+${g}` : g}gg
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleSetStatus(s, 'suspended')} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200">
                            Sospendi
                          </button>
                          <button onClick={() => handleSetStatus(s, 'active')} className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 hover:bg-green-200">
                            Riattiva
                          </button>
                          <button onClick={() => handleSendResetPassword(s)} className="premi rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-200">
                            Invia reset password
                          </button>
                          <button onClick={() => handleGenerateOtp(s)} className="premi rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-200">
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
        </Card>

        {otpResult && (
          <Card className="border-gold-300 bg-gold-50">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Codice di riserva per {otpResult.email}</h2>
              <button onClick={() => setOtpResult(null)} className="text-xs text-neutral-500 hover:text-neutral-800">Chiudi</button>
            </div>
            <p className="mb-3 text-xs text-neutral-600">
              Comunica questo codice al cliente (telefono, WhatsApp, email personale): lo inserirà nella pagina
              &quot;Imposta una nuova password&quot; se il link ricevuto via email non funziona. Vale pochi minuti.
            </p>
            <p className="text-2xl font-mono font-bold tracking-widest text-bordeaux-700">{otpResult.otp}</p>
          </Card>
        )}

        <Card className="mb-0">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Log</h2>
          <div className="max-h-32 overflow-y-auto text-xs text-neutral-500">
            {log.length === 0 ? 'Pronto.' : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </Card>
      </div>
    </div>
  );
}

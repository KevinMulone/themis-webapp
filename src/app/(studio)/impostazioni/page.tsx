'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { TIPI_PRATICA, labelFromOptions } from '@/lib/constants';

type Template = { id: string; nome: string; categoria: string | null; descrizione: string | null; studio_id: string | null };
type Settings = { font_family: string; font_size_pt: number; line_spacing: number };
type DayRule = { open: boolean; start_time: string; end_time: string };
type PecAccount = {
  id: string; etichetta: string; indirizzo_pec: string; imap_host: string; imap_port: number;
  imap_user: string; attivo: boolean; ultimo_controllo_at: string | null; ultimo_errore: string | null;
};
type Abbonamento = {
  stripe_customer_id: string | null; plan: string | null;
  subscription_status: string; subscription_expires_at: string | null;
  subscription_started_at: string | null; refund_requested_at: string | null;
};

const FINESTRA_RIMBORSO_MS = 4 * 24 * 60 * 60 * 1000;

function tempoRimborsoRimanente(startedAt: string, adesso: number): number {
  return new Date(startedAt).getTime() + FINESTRA_RIMBORSO_MS - adesso;
}

function formattaTempoRimanente(ms: number): string {
  const totaleMinuti = Math.max(0, Math.floor(ms / 60000));
  const giorni = Math.floor(totaleMinuti / (24 * 60));
  const ore = Math.floor((totaleMinuti % (24 * 60)) / 60);
  if (giorni > 0) return `${giorni}g ${ore}h`;
  const minuti = totaleMinuti % 60;
  return `${ore}h ${minuti}m`;
}

const FONT_CHOICES = ['Times New Roman', 'Garamond', 'Georgia', 'Cambria', 'Calibri', 'Arial', 'Verdana'];
const LINE_SPACING_CHOICES = [1.0, 1.15, 1.5, 2.0];
const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const DEFAULT_DAY: DayRule = { open: false, start_time: '09:00', end_time: '13:00' };
const GESTORI_PEC: { nome: string; host: string; porta: number }[] = [
  { nome: 'Aruba', host: 'imaps.pec.aruba.it', porta: 993 },
  { nome: 'Namirial / Sicurezza Postale', host: 'imaps.sicurezzapostale.it', porta: 993 },
];

export default function ImpostazioniPage() {
  const supabase = createClient();
  const { studioId, userId, ruolo } = useStudio();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<Settings>({ font_family: 'Times New Roman', font_size_pt: 12, line_spacing: 1.5 });
  const [letterhead, setLetterhead] = useState<{ exists: boolean; data_url?: string }>({ exists: false });
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [days, setDays] = useState<DayRule[]>(Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY })));
  const [savingHours, setSavingHours] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const templateFileRef = useRef<HTMLInputElement>(null);
  const letterheadFileRef = useRef<HTMLInputElement>(null);
  const [pecAccounts, setPecAccounts] = useState<PecAccount[]>([]);
  const [pecHost, setPecHost] = useState('');
  const [pecPort, setPecPort] = useState(993);
  const [pecFormError, setPecFormError] = useState('');
  const [pecSalvando, setPecSalvando] = useState(false);
  const [pecSincronizzando, setPecSincronizzando] = useState(false);
  const [pecSyncMsg, setPecSyncMsg] = useState('');
  const pecFormRef = useRef<HTMLFormElement>(null);
  const [abbonamento, setAbbonamento] = useState<Abbonamento | null>(null);
  const [portaleLoading, setPortaleLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [adesso, setAdesso] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAdesso(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    const [{ data: tpl }, { data: s }, letterheadRes, { data: rules }, { data: pec }, { data: studio }] = await Promise.all([
      supabase.from('templates').select('id, nome, categoria, descrizione, studio_id').eq('attivo', true).order('categoria'),
      supabase.from('studio_settings').select('*').eq('studio_id', studioId).single(),
      fetch('/api/settings/letterhead'),
      supabase.from('availability_rules').select('*').eq('studio_id', studioId),
      supabase.from('pec_account')
        .select('id, etichetta, indirizzo_pec, imap_host, imap_port, imap_user, attivo, ultimo_controllo_at, ultimo_errore')
        .order('created_at'),
      // Volutamente userId e non studioId: l'abbonamento è del titolare,
      // non dello studio inteso come gruppo di persone. Vale ovunque si
      // legga studios per Stripe, scadenze o rimborsi — un domani un
      // collaboratore non deve poter disdire l'abbonamento del suo studio.
      supabase.from('studios')
        .select('stripe_customer_id, plan, subscription_status, subscription_expires_at, subscription_started_at, refund_requested_at')
        .eq('id', userId).maybeSingle(),
    ]);
    setTemplates(tpl || []);
    setAbbonamento(studio || null);
    if (s) setSettings({ font_family: s.font_family, font_size_pt: s.font_size_pt, line_spacing: s.line_spacing });
    setLetterhead(await letterheadRes.json());

    if (rules && rules.length > 0) {
      const newDays = Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY, open: false }));
      rules.forEach((r) => {
        newDays[r.day_of_week] = { open: true, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) };
      });
      setDays(newDays);
      setSlotMinutes(rules[0].slot_minutes);
    }
    setPecAccounts(pec || []);
  }

  useEffect(() => { load(); }, []);

  async function handleTemplateUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!templateFileRef.current?.files?.[0]) { alert('Scegli un file .docx'); return; }
    setUploadingTemplate(true);
    const res = await fetch('/api/templates/upload', { method: 'POST', body: form });
    const body = await res.json();
    setUploadingTemplate(false);
    if (!res.ok) { alert(body.error || 'Errore caricamento'); return; }
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function handleLetterheadUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/settings/letterhead', { method: 'POST', body: form });
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Errore caricamento'); return; }
    load();
  }

  async function handleRemoveLetterhead() {
    if (!confirm("Rimuovere l'intestazione?")) return;
    await fetch('/api/settings/letterhead', { method: 'DELETE' });
    load();
  }

  async function handleSaveTypography(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      studio_id: studioId,
      font_family: form.get('font_family') as string,
      font_size_pt: Number(form.get('font_size_pt')),
      line_spacing: Number(form.get('line_spacing')),
    };
    await supabase.from('studio_settings').upsert(payload, { onConflict: 'studio_id' });
    alert('Impostazioni salvate');
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordMsg(null);
    const form = new FormData(e.currentTarget);
    const newPassword = form.get('new_password') as string;
    const confirmPassword = form.get('confirm_password') as string;
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'La password deve avere almeno 8 caratteri.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Le due password non coincidono.' });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { setPasswordMsg({ type: 'error', text: error.message }); return; }
    setPasswordMsg({ type: 'ok', text: 'Password aggiornata.' });
    (e.target as HTMLFormElement).reset();
  }

  async function handleAddPecAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPecFormError('');
    const form = new FormData(e.currentTarget);
    setPecSalvando(true);
    const res = await fetch('/api/pec/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etichetta: form.get('etichetta'),
        indirizzo_pec: form.get('indirizzo_pec'),
        imap_host: form.get('imap_host'),
        imap_port: Number(form.get('imap_port')),
        imap_user: form.get('imap_user'),
        password: form.get('password'),
      }),
    });
    const body = await res.json();
    setPecSalvando(false);
    if (!res.ok) { setPecFormError(body.error || 'Errore di salvataggio'); return; }
    pecFormRef.current?.reset();
    setPecHost('');
    setPecPort(993);
    load();
  }

  async function handleDeletePecAccount(id: string) {
    if (!confirm('Rimuovere questa casella PEC? I messaggi già scaricati restano nello storico.')) return;
    await fetch(`/api/pec/account?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function handleSyncPec() {
    setPecSincronizzando(true);
    setPecSyncMsg('');
    const res = await fetch('/api/pec/sync', { method: 'POST' });
    const body = await res.json();
    setPecSincronizzando(false);
    if (!res.ok) { setPecSyncMsg(`Errore: ${body.error}`); return; }
    const totale = (body.risultati || []).reduce((s: number, r: { messaggiScaricati: number }) => s + r.messaggiScaricati, 0);
    setPecSyncMsg(totale > 0 ? `${totale} nuovo/i messaggio/i scaricato/i.` : 'Nessun messaggio nuovo.');
    load();
  }

  async function handleGestisciAbbonamento() {
    setPortaleLoading(true);
    const res = await fetch('/api/billing-portal', { method: 'POST' });
    const body = await res.json();
    setPortaleLoading(false);
    if (!res.ok) { alert(body.error || 'Impossibile aprire il portale di gestione'); return; }
    window.location.href = body.url;
  }

  function handleEntraComeAmministratore() {
    // Non è una vera barriera di sicurezza (è codice lato client, quindi
    // ispezionabile): la protezione reale resta il controllo server-side in
    // /admin, che verifica l'email dell'account collegato. Questo PIN serve
    // solo a non rendere l'ingresso ovvio a chi guarda lo schermo.
    const pin = prompt('Password amministratore');
    if (pin === null) return;
    if (pin !== '13052003') { alert('Password errata'); return; }
    window.location.href = '/admin';
  }

  async function handleRichiediRimborso() {
    if (!confirm('Vuoi davvero richiedere il rimborso? Il tuo account verrà sospeso subito: potrai tornare a usarlo solo riacquistando un abbonamento.')) return;
    setRefundLoading(true);
    const res = await fetch('/api/refund-request', { method: 'POST' });
    const body = await res.json();
    if (!res.ok) {
      setRefundLoading(false);
      alert(body.error || 'Impossibile inviare la richiesta');
      return;
    }
    // L'account è stato appena sospeso lato server: reindirizza subito,
    // non ha senso restare su una pagina che non potrà più usare.
    window.location.href = '/account-sospeso?motivo=sospeso';
  }

  function updateDay(index: number, patch: Partial<DayRule>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  async function handleSaveHours() {
    setSavingHours(true);
    await supabase.from('availability_rules').delete().eq('studio_id', studioId);
    const rows = days
      .map((d, i) => ({ ...d, day_of_week: i }))
      .filter((d) => d.open)
      .map((d) => ({
        studio_id: studioId, day_of_week: d.day_of_week,
        start_time: d.start_time, end_time: d.end_time, slot_minutes: slotMinutes,
      }));
    if (rows.length > 0) {
      const { error } = await supabase.from('availability_rules').insert(rows);
      if (error) { alert(error.message); setSavingHours(false); return; }
    }
    setSavingHours(false);
    alert('Orari salvati');
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-display font-semibold text-neutral-900">Impostazioni</h1>

      <form onSubmit={handleChangePassword} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Cambia password</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Nuova password</label>
            <input name="new_password" type="password" autoComplete="new-password" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Conferma password</label>
            <input name="confirm_password" type="password" autoComplete="new-password" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>
        {passwordMsg && (
          <p className={`mt-3 text-sm ${passwordMsg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{passwordMsg.text}</p>
        )}
        <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
          <button type="submit" disabled={changingPassword} className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
            {changingPassword ? 'Salvataggio...' : 'Aggiorna password'}
          </button>
        </div>
      </form>

      {ruolo === 'titolare' && (
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Abbonamento</h2>
        {abbonamento?.stripe_customer_id ? (
          <>
            <p className="mb-3 text-sm text-neutral-600">
              Piano {abbonamento.plan || '—'} · {abbonamento.subscription_status === 'active' ? 'attivo' : 'sospeso'}
              {abbonamento.subscription_expires_at
                ? ` · rinnovo/scadenza il ${new Date(abbonamento.subscription_expires_at).toLocaleDateString('it-IT')}`
                : ''}
            </p>
            <button
              onClick={handleGestisciAbbonamento}
              disabled={portaleLoading}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              {portaleLoading ? 'Apertura...' : 'Gestisci abbonamento'}
            </button>

            {abbonamento.refund_requested_at ? (
              <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-500">
                Richiesta di rimborso inviata il {new Date(abbonamento.refund_requested_at).toLocaleDateString('it-IT')}. Verrai contattato a breve.
              </p>
            ) : abbonamento.subscription_started_at && tempoRimborsoRimanente(abbonamento.subscription_started_at, adesso) > 0 ? (
              <div className="mt-4 border-t border-neutral-200 pt-4">
                <p className="mb-2 text-xs text-neutral-500">
                  Puoi richiedere il rimborso entro {formattaTempoRimanente(tempoRimborsoRimanente(abbonamento.subscription_started_at, adesso))} dal primo pagamento.
                </p>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full bg-bordeaux-700"
                    style={{ width: `${Math.max(0, Math.min(1, tempoRimborsoRimanente(abbonamento.subscription_started_at, adesso) / FINESTRA_RIMBORSO_MS)) * 100}%` }}
                  />
                </div>
                <button
                  onClick={handleRichiediRimborso}
                  disabled={refundLoading}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {refundLoading ? 'Invio...' : 'Chiedi il rimborso'}
                </button>
                {' '}
                <a href="/politica-rimborsi" target="_blank" className="ml-2 text-xs text-neutral-400 hover:underline">
                  Leggi la policy di rimborso
                </a>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            Il tuo abbonamento non è collegato a un pagamento automatico Stripe (attivato con una chiave fornita
            direttamente dallo studio).
          </p>
        )}
      </div>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Intestazione documenti</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Immagine (logo e dati dello studio) usata automaticamente nell&apos;intestazione di ogni documento generato.
        </p>
        {letterhead.exists ? (
          <img src={letterhead.data_url} alt="Intestazione" className="mb-3 max-h-40 rounded border border-neutral-200" />
        ) : (
          <p className="mb-3 text-sm text-neutral-400">Nessuna intestazione caricata.</p>
        )}
        <div className="flex gap-2">
          <button onClick={() => letterheadFileRef.current?.click()} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            Carica intestazione...
          </button>
          <input ref={letterheadFileRef} type="file" accept="image/*" className="hidden" onChange={handleLetterheadUpload} />
          {letterhead.exists && (
            <button onClick={handleRemoveLetterhead} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
              Rimuovi
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveTypography} className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Formattazione documenti</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Carattere</label>
            <select name="font_family" defaultValue={settings.font_family} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Dimensione (pt)</label>
            <input type="number" name="font_size_pt" min={6} max={32} step={0.5} defaultValue={settings.font_size_pt} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Interlinea</label>
            <select name="line_spacing" defaultValue={settings.line_spacing} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {LINE_SPACING_CHOICES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
          <button type="submit" className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
            Salva
          </button>
        </div>
      </form>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Orari di disponibilità per il portale clienti</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Gli assistiti potranno prenotare un appuntamento online solo in questi orari.
        </p>
        <div className="mb-3 space-y-2">
          {GIORNI.map((label, i) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <label className="flex w-32 items-center gap-2">
                <input type="checkbox" checked={days[i].open} onChange={(e) => updateDay(i, { open: e.target.checked })} />
                {label}
              </label>
              <input
                type="time" value={days[i].start_time} disabled={!days[i].open}
                onChange={(e) => updateDay(i, { start_time: e.target.value })}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
              />
              <span className="text-neutral-400">–</span>
              <input
                type="time" value={days[i].end_time} disabled={!days[i].open}
                onChange={(e) => updateDay(i, { end_time: e.target.value })}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
              />
            </div>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <label className="text-xs text-neutral-500">Durata slot (minuti)</label>
          <input
            type="number" min={10} max={120} step={5} value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <button onClick={handleSaveHours} disabled={savingHours} className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
            {savingHours ? 'Salvataggio...' : 'Salva orari'}
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Caselle PEC</h2>
          {pecAccounts.length > 0 && (
            <button
              onClick={handleSyncPec} disabled={pecSincronizzando}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50"
            >
              {pecSincronizzando ? 'Sincronizzazione...' : 'Sincronizza ora'}
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          La password della PEC non basta più da sola se hai attivato la verifica in due passaggi: serve una
          password dedicata &quot;per programmi di posta&quot;, generata dal pannello del tuo gestore. Non è la
          password con cui accedi alla webmail.
        </p>
        {pecSyncMsg && <p className="mb-3 text-sm text-neutral-600">{pecSyncMsg}</p>}
        {pecAccounts.length > 0 && (
          <ul className="mb-4 divide-y divide-neutral-100 text-sm">
            {pecAccounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-neutral-800">{a.etichetta} — {a.indirizzo_pec}</div>
                  <div className="text-xs text-neutral-400">
                    {a.ultimo_controllo_at
                      ? `Ultimo controllo: ${new Date(a.ultimo_controllo_at).toLocaleString('it-IT')}`
                      : 'Non ancora sincronizzata'}
                  </div>
                  {a.ultimo_errore && <div className="text-xs text-red-600">Errore: {a.ultimo_errore}</div>}
                </div>
                <button onClick={() => handleDeletePecAccount(a.id)} className="text-xs text-red-600 hover:underline">
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>
        )}
        <form ref={pecFormRef} onSubmit={handleAddPecAccount} className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Etichetta (per riconoscerla in elenco)</label>
            <input name="etichetta" required placeholder="Es. PEC studio" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Indirizzo PEC</label>
            <input name="indirizzo_pec" type="email" required placeholder="nome@pec.it" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Gestore (precompila host e porta)</label>
            <select
              defaultValue=""
              onChange={(e) => {
                const g = GESTORI_PEC.find((x) => x.nome === e.target.value);
                if (g) { setPecHost(g.host); setPecPort(g.porta); } else { setPecHost(''); setPecPort(993); }
              }}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Altro (inserisci host manualmente)</option>
              {GESTORI_PEC.map((g) => <option key={g.nome} value={g.nome}>{g.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Host IMAP</label>
            <input
              name="imap_host" required value={pecHost} onChange={(e) => setPecHost(e.target.value)}
              placeholder="imaps.pec.esempio.it" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Porta</label>
            <input
              name="imap_port" type="number" required value={pecPort} onChange={(e) => setPecPort(Number(e.target.value))}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Nome utente IMAP</label>
            <input name="imap_user" required placeholder="di solito l'indirizzo PEC stesso" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Password per programmi di posta</label>
            <input name="password" type="password" required autoComplete="new-password" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          {pecFormError && <p className="col-span-2 text-sm text-red-600">{pecFormError}</p>}
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={pecSalvando} className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
              {pecSalvando ? 'Salvataggio...' : 'Aggiungi casella'}
            </button>
          </div>
        </form>
      </div>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-neutral-900">Modelli disponibili ({templates.length})</h2>
        <p className="mb-3 text-xs text-neutral-500">
          I modelli &quot;di sistema&quot; sono forniti da Themis e uguali per tutti gli studi. Puoi caricarne di tuoi:
          restano privati e cifrati, visibili solo a questo studio.
        </p>
        <ul className="mb-4 max-h-64 divide-y divide-neutral-100 overflow-y-auto text-sm">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <div>
                <div>{t.nome}</div>
                <div className="text-xs text-neutral-400">{labelFromOptions(TIPI_PRATICA, t.categoria || '')}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${t.studio_id ? 'bg-bordeaux-50 text-bordeaux-700' : 'bg-gold-100 text-gold-700'}`}>
                {t.studio_id ? 'Personalizzato' : 'Di sistema'}
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleTemplateUpload} className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Nome modello</label>
            <input name="nome" required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
            <select name="categoria" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {TIPI_PRATICA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">File .docx</label>
            <input ref={templateFileRef} type="file" name="file" accept=".docx" required className="w-full text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Descrizione</label>
            <input name="descrizione" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={uploadingTemplate} className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
              {uploadingTemplate ? 'Caricamento...' : 'Carica modello'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex justify-center py-6">
        <button
          onClick={handleEntraComeAmministratore}
          aria-label="Accesso avanzato"
          className="h-2 w-2 rounded-full bg-neutral-200 hover:bg-neutral-300"
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { LIMITE_FILE_BYTES, messaggioFileTroppoGrande } from '@/lib/spazioCostanti';
import ContatoreSpazio from './ContatoreSpazio';
import { TIPI_PRATICA, labelFromOptions } from '@/lib/constants';
import { leggiIcs, type ImpegnoImportato as ImpegnoLetto } from '@/lib/calendario/leggiIcs';
// WhatsApp temporaneamente nascosto dall'interfaccia (funzionalità instabile).
// import ImpostazioniWhatsapp from './ImpostazioniWhatsapp';
import ImpostazioniElenco from './ImpostazioniElenco';
import MfaSetup from './MfaSetup';

type Template = { id: string; nome: string; categoria: string | null; descrizione: string | null; studio_id: string | null };
type Settings = { font_family: string; font_size_pt: number; line_spacing: number };
type DatiAvvocato = {
  avvocato_cognome: string; avvocato_nome: string; avvocato_codice_fiscale: string;
  avvocato_indirizzo: string; avvocato_cap: string; avvocato_citta: string; avvocato_provincia: string;
};
const AVVOCATO_VUOTO: DatiAvvocato = {
  avvocato_cognome: '', avvocato_nome: '', avvocato_codice_fiscale: '',
  avvocato_indirizzo: '', avvocato_cap: '', avvocato_citta: '', avvocato_provincia: '',
};
type DayRule = { open: boolean; start_time: string; end_time: string };
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
export default function ImpostazioniPage() {
  const supabase = createClient();
  const { studioId, userId, ruolo } = useStudio();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<Settings>({ font_family: 'Times New Roman', font_size_pt: 12, line_spacing: 1.5 });
  const [avvocato, setAvvocato] = useState<DatiAvvocato>(AVVOCATO_VUOTO);
  const [letterhead, setLetterhead] = useState<{ exists: boolean; data_url?: string }>({ exists: false });
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [days, setDays] = useState<DayRule[]>(Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY })));
  const [savingHours, setSavingHours] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const templateFileRef = useRef<HTMLInputElement>(null);
  const letterheadFileRef = useRef<HTMLInputElement>(null);
  const [abbonamento, setAbbonamento] = useState<Abbonamento | null>(null);
  const [portaleLoading, setPortaleLoading] = useState(false);
  const [mostraPinAdmin, setMostraPinAdmin] = useState(false);
  const [pinAdmin, setPinAdmin] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [adesso, setAdesso] = useState(() => Date.now());

  const [googleAccount, setGoogleAccount] = useState<{ google_email: string; attivo: boolean } | null>(null);
  // null = non ancora saputo; false = mancano le credenziali Google su questo sito.
  const [googleConfigurato, setGoogleConfigurato] = useState<boolean | null>(null);
  const [googleMsg, setGoogleMsg] = useState('');
  const [googleCambiandoStato, setGoogleCambiandoStato] = useState(false);
  const [googleDisconnettendo, setGoogleDisconnettendo] = useState(false);
  const [googleImportando, setGoogleImportando] = useState(false);
  const [googleImportaDa, setGoogleImportaDa] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [googleImportaA, setGoogleImportaA] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  });
  const [googleImportoMsg, setGoogleImportoMsg] = useState('');

  type AnteprimaIcs = {
    totaleNelFile: number; daImportare: number; ricorrenti: number;
    primaData: string | null; ultimaData: string | null;
    esempi: { titolo: string; data: string; ora: string | null }[];
  };
  const [migrDaImportare, setMigrDaImportare] = useState<ImpegnoLetto[]>([]);
  const [migrFile, setMigrFile] = useState<File | null>(null);
  const [migrDa, setMigrDa] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [migrAnteprima, setMigrAnteprima] = useState<AnteprimaIcs | null>(null);
  const [migrInCorso, setMigrInCorso] = useState(false);
  const [migrMsg, setMigrMsg] = useState('');
  const migrRef = useRef<HTMLInputElement>(null);

  /**
   * Legge il file nel browser. Il calendario completo di un avvocato
   * contiene anche la sua vita privata: così non lascia mai il computer,
   * e viaggia soltanto ciò che ha scelto di importare.
   */
  async function leggiFileMigrazione(): Promise<ImpegnoLetto[]> {
    if (!migrFile) return [];
    const nome = migrFile.name.toLowerCase();
    let testi: string[] = [];

    if (nome.endsWith('.zip')) {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(await migrFile.arrayBuffer());
      const dentro = Object.values(zip.files).filter((f) => !f.dir && f.name.toLowerCase().endsWith('.ics'));
      if (dentro.length === 0) throw new Error('Nello zip non c’è nessun file .ics');
      testi = await Promise.all(dentro.map((f) => f.async('string')));
    } else {
      testi = [await migrFile.text()];
    }

    let letti: ImpegnoLetto[] = [];
    for (const t of testi) {
      if (t.includes('BEGIN:VCALENDAR')) letti = letti.concat(leggiIcs(t));
    }
    return letti;
  }

  async function handleMigrAnteprima() {
    setMigrInCorso(true);
    setMigrMsg('');
    setMigrAnteprima(null);
    try {
      const letti = await leggiFileMigrazione();
      if (letti.length === 0) { setMigrMsg('Nel file non risultano impegni leggibili.'); return; }
      const scelti = letti.filter((i) => !migrDa || i.data >= migrDa);
      const date = scelti.map((i) => i.data).sort();
      setMigrDaImportare(scelti);
      setMigrAnteprima({
        totaleNelFile: letti.length,
        daImportare: scelti.length,
        ricorrenti: scelti.filter((i) => i.ricorrente).length,
        primaData: date[0] ?? null,
        ultimaData: date[date.length - 1] ?? null,
        esempi: scelti.slice(0, 5).map((i) => ({ titolo: i.titolo, data: i.data, ora: i.ora_inizio })),
      });
    } catch (e) {
      setMigrMsg(e instanceof Error ? e.message : 'Il file non si riesce a leggere');
    } finally {
      setMigrInCorso(false);
    }
  }

  async function handleMigrImporta() {
    setMigrInCorso(true);
    setMigrMsg('');
    let importati = 0;
    let saltati = 0;
    try {
      // A blocchi: una sola richiesta con migliaia di impegni supererebbe
      // il limite di 4,5 MB che Vercel impone e che non si può alzare.
      for (let i = 0; i < migrDaImportare.length; i += 400) {
        const blocco = migrDaImportare.slice(i, i + 400);
        const res = await fetch('/api/calendario/importa-ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ impegni: blocco }),
        });
        const b = await res.json().catch(() => null);
        if (!res.ok || !b) {
          setMigrMsg(
            (b?.error || `Importazione interrotta (errore ${res.status})`)
            + (importati ? ` — ${importati} impegni erano già stati importati.` : ''),
          );
          return;
        }
        importati += b.importati;
        saltati += b.saltati;
      }
      const ricorrenti = migrDaImportare.filter((i) => i.ricorrente).length;
      setMigrAnteprima(null);
      setMigrDaImportare([]);
      setMigrFile(null);
      if (migrRef.current) migrRef.current.value = '';
      setMigrMsg(
        `Importati ${importati} impegni nel calendario di Themis.`
        + (saltati ? ` ${saltati} erano già presenti e sono stati saltati.` : '')
        + (ricorrenti ? ` ${ricorrenti} erano ricorrenti: ne è stata importata solo la prima data.` : ''),
      );
    } catch {
      setMigrMsg('Importazione non riuscita: controlla la connessione e riprova.');
    } finally {
      setMigrInCorso(false);
    }
  }

  const [icsToken, setIcsToken] = useState<string | null>(null);
  const [icsInCorso, setIcsInCorso] = useState(false);
  const [icsCopiato, setIcsCopiato] = useState(false);

  const linkIcs = icsToken
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/api/calendario/ics/${icsToken}`
    : '';

  async function handleIcsGenera(rigenera: boolean) {
    if (rigenera && !confirm(
      'Rigenerare il link?\n\nQuello attuale smetterà subito di funzionare: chi lo aveva già iscritto in Google Calendar non vedrà più gli aggiornamenti finché non gli dai il nuovo indirizzo.',
    )) return;
    setIcsInCorso(true);
    const res = await fetch('/api/calendario/link', { method: 'POST' });
    setIcsInCorso(false);
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Operazione non riuscita'); return; }
    const b = await res.json();
    setIcsToken(b.token);
    setIcsCopiato(false);
  }

  async function handleIcsSpegni() {
    if (!confirm('Smettere di pubblicare il calendario? Il link smetterà di funzionare per chiunque lo abbia.')) return;
    setIcsInCorso(true);
    const res = await fetch('/api/calendario/link', { method: 'DELETE' });
    setIcsInCorso(false);
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Operazione non riuscita'); return; }
    setIcsToken(null);
  }

  async function handleIcsCopia() {
    await navigator.clipboard.writeText(linkIcs);
    setIcsCopiato(true);
    setTimeout(() => setIcsCopiato(false), 2000);
  }

  useEffect(() => {
    // L'esito torna nell'indirizzo dopo il rimbalzo su Google: si legge
    // qui, non con useSearchParams, per non dover avvolgere l'intera
    // pagina in una Suspense boundary solo per un messaggio di cortesia.
    const esito = new URLSearchParams(window.location.search).get('google');
    const messaggi: Record<string, string> = {
      connesso: 'Google Calendar collegato.',
      annullato: 'Collegamento annullato.',
      solo_titolare: 'Solo il titolare può collegare Google Calendar.',
      non_configurato: 'Google Calendar non è ancora attivo su questo sito.',
      senza_refresh_token: 'Per ricollegare, prima scollega e poi ricollega di nuovo.',
      errore: 'Collegamento non riuscito. Riprova.',
    };
    if (esito && messaggi[esito]) {
      setGoogleMsg(messaggi[esito]);
      window.history.replaceState({}, '', '/impostazioni');
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAdesso(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    const [{ data: tpl }, { data: s }, letterheadRes, { data: rules }, { data: studio }, { data: google }] = await Promise.all([
      supabase.from('templates').select('id, nome, categoria, descrizione, studio_id').eq('attivo', true).order('categoria'),
      supabase.from('studio_settings').select('*').eq('studio_id', studioId).single(),
      fetch('/api/settings/letterhead'),
      supabase.from('availability_rules').select('*').eq('studio_id', studioId),
      // Volutamente userId e non studioId: l'abbonamento è del titolare,
      // non dello studio inteso come gruppo di persone. Vale ovunque si
      // legga studios per Stripe, scadenze o rimborsi — un domani un
      // collaboratore non deve poter disdire l'abbonamento del suo studio.
      supabase.from('studios')
        .select('stripe_customer_id, plan, subscription_status, subscription_expires_at, subscription_started_at, refund_requested_at')
        .eq('id', userId).maybeSingle(),
      supabase.from('google_calendar_account').select('google_email, attivo').eq('studio_id', studioId).maybeSingle(),
    ]);
    setTemplates(tpl || []);
    setAbbonamento(studio || null);
    setGoogleAccount(google || null);
    fetch('/api/google-calendar/stato')
      .then((r) => (r.ok ? r.json() : { configurato: false }))
      .then((b) => setGoogleConfigurato(!!b.configurato))
      .catch(() => setGoogleConfigurato(false));
    if (s) {
      setSettings({ font_family: s.font_family, font_size_pt: s.font_size_pt, line_spacing: s.line_spacing });
      setIcsToken(s.calendario_ics_token || null);
      setAvvocato({
        avvocato_cognome: s.avvocato_cognome || '', avvocato_nome: s.avvocato_nome || '',
        avvocato_codice_fiscale: s.avvocato_codice_fiscale || '', avvocato_indirizzo: s.avvocato_indirizzo || '',
        avvocato_cap: s.avvocato_cap || '', avvocato_citta: s.avvocato_citta || '',
        avvocato_provincia: s.avvocato_provincia || '',
      });
    }
    setLetterhead(await letterheadRes.json());

    if (rules && rules.length > 0) {
      const newDays = Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY, open: false }));
      rules.forEach((r) => {
        newDays[r.day_of_week] = { open: true, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) };
      });
      setDays(newDays);
      setSlotMinutes(rules[0].slot_minutes);
    }
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
    if (file.size > LIMITE_FILE_BYTES) { alert(messaggioFileTroppoGrande(file.size)); e.target.value = ''; return; }
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

  /**
   * Cognome, nome, codice fiscale e domicilio del difensore: gli unici dati
   * anagrafici che Themis non aveva mai chiesto, perché servivano solo per
   * il prontuario di deposito (schermata "Avvocato" di SLpct), non per
   * generare atti o fatture. Compilati una volta, restano qui.
   */
  async function handleSaveAvvocato(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      studio_id: studioId,
      avvocato_cognome: (form.get('avvocato_cognome') as string) || null,
      avvocato_nome: (form.get('avvocato_nome') as string) || null,
      avvocato_codice_fiscale: (form.get('avvocato_codice_fiscale') as string) || null,
      avvocato_indirizzo: (form.get('avvocato_indirizzo') as string) || null,
      avvocato_cap: (form.get('avvocato_cap') as string) || null,
      avvocato_citta: (form.get('avvocato_citta') as string) || null,
      avvocato_provincia: (form.get('avvocato_provincia') as string) || null,
    };
    await supabase.from('studio_settings').upsert(payload, { onConflict: 'studio_id' });
    alert('Dati salvati');
  }

  async function handleGoogleAttivo(attivo: boolean) {
    setGoogleCambiandoStato(true);
    const res = await fetch('/api/google-calendar/attivo', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attivo }),
    });
    setGoogleCambiandoStato(false);
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Operazione non riuscita'); return; }
    setGoogleAccount((prev) => (prev ? { ...prev, attivo } : prev));
  }

  async function handleGoogleDisconnetti() {
    if (!confirm('Scollegare Google Calendar? Gli impegni già copiati resteranno su Google, ma Themis smetterà di aggiornarli.')) return;
    setGoogleDisconnettendo(true);
    const res = await fetch('/api/google-calendar/disconnetti', { method: 'POST' });
    setGoogleDisconnettendo(false);
    if (!res.ok) { const b = await res.json(); alert(b.error || 'Operazione non riuscita'); return; }
    setGoogleAccount(null);
  }

  async function handleGoogleImporta() {
    setGoogleImportando(true);
    setGoogleImportoMsg('');
    const res = await fetch('/api/google-calendar/importa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ da: googleImportaDa, a: googleImportaA }),
    });
    const body = await res.json();
    setGoogleImportando(false);
    if (!res.ok) { setGoogleImportoMsg(body.error || 'Importazione non riuscita'); return; }
    setGoogleImportoMsg(
      body.importati === 0
        ? 'Nessun impegno nuovo da importare in questo intervallo.'
        : `Importati ${body.importati} impegni nel calendario di Themis.`,
    );
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

  async function handleGestisciAbbonamento() {
    setPortaleLoading(true);
    const res = await fetch('/api/billing-portal', { method: 'POST' });
    const body = await res.json();
    setPortaleLoading(false);
    if (!res.ok) { alert(body.error || 'Impossibile aprire il portale di gestione'); return; }
    window.location.href = body.url;
  }

  // Non è una vera barriera di sicurezza (è codice lato client, quindi
  // ispezionabile): la protezione reale resta il controllo server-side in
  // /admin, che verifica l'email dell'account collegato. Questa password
  // serve solo a non rendere l'ingresso ovvio a chi guarda lo schermo.
  function handlePinAdmin(valore: string) {
    setPinAdmin(valore);
    // Apre appena la password è completa e corretta: nessun pulsante da
    // premere, nessuna finestrella del browser (che su telefono è scomoda
    // e a volte viene bloccata).
    if (valore === '13052003') window.location.href = '/admin';
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
    <div className="mx-auto max-w-5xl">
      <p className="module-eyebrow">Configurazione</p>
      <h1 className="mb-6 font-display text-[28px] font-semibold tracking-tight text-neutral-900">Impostazioni</h1>

      <nav aria-label="Sezioni impostazioni" className="sticky top-3 z-20 mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-lg shadow-black/[0.04] backdrop-blur-xl">
        {[
          ['sicurezza', 'Sicurezza'], ['abbonamento', 'Abbonamento'], ['documenti', 'Documenti'],
          ['deposito', 'Deposito'], ['portale', 'Portale'], ['calendario', 'Calendario'],
          ['modelli', 'Modelli'],
        ].map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-bordeaux-50 hover:text-bordeaux-700">{label}</a>)}
      </nav>

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
        <div>
          <h2 className="font-semibold text-neutral-900">Guida — Come usare Themis</h2>
          <p className="mt-1 text-sm text-neutral-500">La guida pratica alle funzionalità di Themis, in PDF.</p>
        </div>
        <a
          href="/guide/come-usare-themis.pdf"
          download="Come usare Themis.pdf"
          className="premi shrink-0 rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800"
        >
          Scarica il PDF
        </a>
      </div>

      <form id="sicurezza" onSubmit={handleChangePassword} className="scroll-mt-24 mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
        <h2 className="mb-3 font-semibold text-neutral-900">Cambia password</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Nuova password</label>
            <input name="new_password" type="password" autoComplete="new-password" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Conferma password</label>
            <input name="confirm_password" type="password" autoComplete="new-password" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
        </div>
        {ruolo === 'titolare' && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <div>
              <p className="text-sm font-semibold text-neutral-800">Backup dei dati dello studio</p>
              <p className="mt-0.5 max-w-xl text-xs text-neutral-500">Scarica anagrafiche, pratiche, calendario, incarichi e registri in un archivio ZIP. I file cifrati e le credenziali non vengono esportati.</p>
            </div>
            <a href="/api/studio/export" download className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-200">Esporta backup</a>
          </div>
        )}
        <MfaSetup />
        {passwordMsg && (
          <p className={`mt-3 text-sm ${passwordMsg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{passwordMsg.text}</p>
        )}
        <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
          <button type="submit" disabled={changingPassword} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
            {changingPassword ? 'Salvataggio...' : 'Aggiorna password'}
          </button>
        </div>
      </form>

      {ruolo === 'titolare' && (
      <div id="abbonamento" className="scroll-mt-24 mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
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
              className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200 disabled:opacity-50"
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
                  className="premi rounded-full bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
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

      {ruolo === 'titolare' && <ImpostazioniElenco />}

      {ruolo === 'titolare' && <ContatoreSpazio />}

      <div id="documenti" className="scroll-mt-24 mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
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
          <button onClick={() => letterheadFileRef.current?.click()} className="premi rounded-full bg-neutral-100 px-3 py-1.5 text-sm hover:bg-neutral-200">
            Carica intestazione...
          </button>
          <input ref={letterheadFileRef} type="file" accept="image/*" className="hidden" onChange={handleLetterheadUpload} />
          {letterhead.exists && (
            <button onClick={handleRemoveLetterhead} className="premi rounded-full bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100">
              Rimuovi
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveTypography} className="mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
        <h2 className="mb-3 font-semibold text-neutral-900">Formattazione documenti</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Carattere</label>
            <select name="font_family" defaultValue={settings.font_family} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
              {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Dimensione (pt)</label>
            <input type="number" name="font_size_pt" min={6} max={32} step={0.5} defaultValue={settings.font_size_pt} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Interlinea</label>
            <select name="line_spacing" defaultValue={settings.line_spacing} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
              {LINE_SPACING_CHOICES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
          <button type="submit" className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
            Salva
          </button>
        </div>
      </form>

      <form id="deposito" onSubmit={handleSaveAvvocato} className="scroll-mt-24 mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
        <h2 className="mb-1 font-semibold text-neutral-900">Dati del difensore per il deposito</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Servono al prontuario di deposito nella pratica — la schermata &quot;Avvocato&quot; che SLpct chiede
          a ogni busta. Compilali una volta sola.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Cognome</label>
            <input name="avvocato_cognome" defaultValue={avvocato.avvocato_cognome} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Nome</label>
            <input name="avvocato_nome" defaultValue={avvocato.avvocato_nome} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Codice fiscale</label>
            <input name="avvocato_codice_fiscale" defaultValue={avvocato.avvocato_codice_fiscale} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm uppercase outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Indirizzo dello studio</label>
            <input name="avvocato_indirizzo" defaultValue={avvocato.avvocato_indirizzo} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">CAP</label>
            <input name="avvocato_cap" defaultValue={avvocato.avvocato_cap} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Città</label>
            <input name="avvocato_citta" defaultValue={avvocato.avvocato_citta} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Provincia</label>
            <input name="avvocato_provincia" maxLength={2} defaultValue={avvocato.avvocato_provincia} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm uppercase outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
        </div>
        <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
          <button type="submit" className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">
            Salva
          </button>
        </div>
      </form>

      <div id="portale" className="scroll-mt-24 mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
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
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm disabled:bg-neutral-100 outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              />
              <span className="text-neutral-400">–</span>
              <input
                type="time" value={days[i].end_time} disabled={!days[i].open}
                onChange={(e) => updateDay(i, { end_time: e.target.value })}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm disabled:bg-neutral-100 outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
              />
            </div>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <label className="text-xs text-neutral-500">Durata slot (minuti)</label>
          <input
            type="number" min={10} max={120} step={5} value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="w-20 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
          />
        </div>
        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <button onClick={handleSaveHours} disabled={savingHours} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
            {savingHours ? 'Salvataggio...' : 'Salva orari'}
          </button>
        </div>
      </div>

      <div id="calendario" className="scroll-mt-24 mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
        <h2 className="mb-1 font-semibold text-neutral-900">Google Calendar</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Themis resta il calendario vero — colori e collegamento alla pratica continuano
          a funzionare solo qui. Se attivo, ogni impegno creato in Themis viene copiato anche sul tuo Google
          Calendar, così lo vedi sul telefono.
        </p>

        {googleMsg && (
          <p className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">{googleMsg}</p>
        )}

        <div className="mb-5 rounded-lg bg-white p-4">
          <p className="text-sm font-medium text-neutral-900">Porta dentro Themis il calendario che avevi prima</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Per chi arriva da Google Calendar. Su{' '}
            <a href="https://calendar.google.com/calendar/r/settings/export" target="_blank" rel="noreferrer">calendar.google.com</a>
            {' '}apri <em>Impostazioni → Importa ed esporta → Esporta</em>: scarichi un file, e lo carichi qui.
            Non serve collegare l&rsquo;account: è un&rsquo;operazione che si fa una volta sola.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-neutral-400">File esportato (.ics o .zip)</label>
              <input
                ref={migrRef} type="file" accept=".ics,.zip"
                onChange={(e) => { setMigrFile(e.target.files?.[0] ?? null); setMigrAnteprima(null); setMigrMsg(''); }}
                className="text-xs text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3.5 file:py-1.5 file:text-xs file:font-medium file:text-neutral-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-neutral-400">Solo impegni dal</label>
              <input
                type="date" value={migrDa}
                onChange={(e) => { setMigrDa(e.target.value); setMigrAnteprima(null); }}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none transition-colors focus:border-bordeaux-400"
              />
            </div>
            <button
              type="button" onClick={handleMigrAnteprima} disabled={!migrFile || migrInCorso}
              className="premi rounded-full bg-neutral-100 px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
            >
              {migrInCorso ? 'Lettura...' : 'Guarda cosa contiene'}
            </button>
          </div>

          {migrAnteprima && (
            <div className="mt-3 rounded-lg bg-neutral-50 p-3">
              {migrAnteprima.daImportare === 0 ? (
                <p className="text-xs text-neutral-600">
                  Nessun impegno in questo intervallo: prova una data d&rsquo;inizio precedente.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-neutral-900">
                    {migrAnteprima.daImportare} impegni da importare
                    <span className="font-normal text-neutral-500">
                      {' '}— dal {migrAnteprima.primaData} al {migrAnteprima.ultimaData}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Il file ne contiene {migrAnteprima.totaleNelFile} in tutto
                    {migrAnteprima.ricorrenti > 0 && `, ${migrAnteprima.ricorrenti} ricorrenti (entra solo la prima data)`}.
                    Entrano tutti come tipo &quot;Attività&quot;: il tipo giusto si mette dopo, sui pochi che contano.
                  </p>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
                    {migrAnteprima.esempi.map((e, i) => (
                      <li key={i} className="truncate">· {e.data}{e.ora ? ` ${e.ora}` : ''} — {e.titolo}</li>
                    ))}
                  </ul>
                  <button
                    type="button" onClick={handleMigrImporta} disabled={migrInCorso}
                    className="premi mt-3 rounded-full bg-bordeaux-700 px-4 py-2 text-xs font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                  >
                    {migrInCorso ? 'Importazione...' : `Importa ${migrAnteprima.daImportare} impegni`}
                  </button>
                </>
              )}
            </div>
          )}

          {migrMsg && <p className="mt-2 text-xs text-neutral-600">{migrMsg}</p>}
        </div>

        <div className="mb-5 rounded-lg bg-white p-4">
          <p className="text-sm font-medium text-neutral-900">Link al calendario — funziona subito</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Il modo più rapido: si copia questo indirizzo e si incolla in Google Calendar, in
            <em> Altri calendari → Iscriviti tramite URL</em>. Gli impegni di Themis compaiono nel tuo
            Google Calendar e sul telefono, senza collegare l&rsquo;account. Google li ricontrolla ogni
            poche ore, quindi una modifica non appare all&rsquo;istante.
          </p>

          {!icsToken ? (
            <button
              type="button" onClick={() => handleIcsGenera(false)} disabled={icsInCorso}
              className="premi mt-3 rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
            >
              {icsInCorso ? 'Creazione...' : 'Crea il link'}
            </button>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-neutral-50 px-3 py-2 font-mono text-[11px] text-neutral-600">
                  {linkIcs}
                </code>
                <button
                  type="button" onClick={handleIcsCopia}
                  className="premi shrink-0 rounded-full bg-neutral-100 px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                >
                  {icsCopiato ? 'Copiato' : 'Copia'}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                Chi ha questo indirizzo legge il calendario dello studio senza dover accedere: trattalo
                come una password. Se finisce dove non doveva, rigeneralo.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button" onClick={() => handleIcsGenera(true)} disabled={icsInCorso}
                  className="premi rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
                >
                  Rigenera
                </button>
                <button
                  type="button" onClick={handleIcsSpegni} disabled={icsInCorso}
                  className="premi rounded-full bg-red-50 px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Smetti di pubblicare
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mb-3 text-xs font-medium text-neutral-500">
          Oppure collega l&rsquo;account, per la sincronizzazione immediata e l&rsquo;importazione
        </p>

        {!googleAccount && googleConfigurato === false ? (
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm font-medium text-neutral-900">Non ancora configurato su questo sito</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Il collegamento a Google richiede due credenziali che vanno create una sola volta sulla
              Google Cloud Console (un ID client OAuth) e inserite fra le variabili d&rsquo;ambiente del sito
              come <span className="font-medium text-neutral-700">GOOGLE_CLIENT_ID</span> e{' '}
              <span className="font-medium text-neutral-700">GOOGLE_CLIENT_SECRET</span>. Finché mancano,
              il collegamento non può partire.
            </p>
          </div>
        ) : !googleAccount ? (
          <>
            <p className="mb-3 text-xs leading-relaxed text-neutral-500">
              Nella schermata di Google potresti vedere l&rsquo;avviso <em>&quot;Google non ha verificato
              questa app&quot;</em>: compare finché la verifica è in corso e non indica un problema.
              Per proseguire apri <span className="font-medium text-neutral-700">Avanzate</span> e scegli
              di continuare. Themis chiede il permesso sui soli eventi del calendario, non sul resto
              dell&rsquo;account.
            </p>
            <a
            href="/api/google-calendar/connetti"
            className={`premi inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white ${
              googleConfigurato === null ? 'pointer-events-none bg-neutral-300' : 'bg-bordeaux-700 hover:bg-bordeaux-800'
            }`}
          >
            {googleConfigurato === null ? 'Verifica in corso...' : 'Collega Google Calendar'}
            </a>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">Connesso come {googleAccount.google_email}</p>
                <p className="text-xs text-neutral-500">
                  {googleAccount.attivo ? 'Sincronizzazione attiva' : 'Sincronizzazione in pausa'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button" onClick={() => handleGoogleAttivo(!googleAccount.attivo)} disabled={googleCambiandoStato}
                  className="premi rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
                >
                  {googleAccount.attivo ? 'Metti in pausa' : 'Riattiva'}
                </button>
                <button
                  type="button" onClick={handleGoogleDisconnetti} disabled={googleDisconnettendo}
                  className="premi rounded-full bg-red-50 px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Scollega
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="mb-2 text-xs font-medium text-neutral-600">
                Importa in Themis ciò che c&apos;era già in questo Google Calendar
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-400">Da</label>
                  <input
                    type="date" value={googleImportaDa} onChange={(e) => setGoogleImportaDa(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none transition-colors focus:border-bordeaux-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-400">A</label>
                  <input
                    type="date" value={googleImportaA} onChange={(e) => setGoogleImportaA(e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none transition-colors focus:border-bordeaux-400"
                  />
                </div>
                <button
                  type="button" onClick={handleGoogleImporta} disabled={googleImportando}
                  className="premi rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {googleImportando ? 'Importazione...' : 'Importa'}
                </button>
              </div>
              {googleImportoMsg && <p className="mt-2 text-xs text-neutral-500">{googleImportoMsg}</p>}
              <p className="mt-2 text-[11px] text-neutral-400">
                Themis riconosce automaticamente udienze, termini e appuntamenti quando il titolo è chiaro;
                gli eventi dubbi restano &quot;Attività&quot; e possono essere riclassificati.
              </p>
            </div>
          </div>
        )}
      </div>

      <div id="modelli" className="scroll-mt-24 mb-4 rounded-2xl bg-white ring-1 ring-black/[0.04] p-6">
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
            <input name="nome" required className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
            <select name="categoria" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
              {TIPI_PRATICA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">File .docx</label>
            <input ref={templateFileRef} type="file" name="file" accept=".docx" required className="w-full text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Descrizione</label>
            <input name="descrizione" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={uploadingTemplate} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
              {uploadingTemplate ? 'Caricamento...' : 'Carica modello'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex justify-center py-6">
        {mostraPinAdmin ? (
          <input
            type="password"
            autoFocus
            inputMode="numeric"
            value={pinAdmin}
            onChange={(e) => handlePinAdmin(e.target.value)}
            onBlur={() => { if (!pinAdmin) setMostraPinAdmin(false); }}
            aria-label="Password amministratore"
            className="w-40 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-center text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
          />
        ) : (
          <button
            onClick={() => setMostraPinAdmin(true)}
            aria-label="Accesso avanzato"
            className="h-2 w-2 rounded-full bg-neutral-200 hover:bg-neutral-300"
          />
        )}
      </div>
    </div>
  );
}

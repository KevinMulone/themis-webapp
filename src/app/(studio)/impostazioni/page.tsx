'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { TIPI_PRATICA, labelFromOptions } from '@/lib/constants';

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
  const [pecAccounts, setPecAccounts] = useState<PecAccount[]>([]);
  const [pecHost, setPecHost] = useState('');
  const [pecPort, setPecPort] = useState(993);
  const [pecFormError, setPecFormError] = useState('');
  const [pecSalvando, setPecSalvando] = useState(false);
  const [pecSincronizzando, setPecSincronizzando] = useState(false);
  const [pecSyncMsg, setPecSyncMsg] = useState('');
  const [pecSecondi, setPecSecondi] = useState(0);
  const [pecAncora, setPecAncora] = useState(false);
  const [pecArretrato, setPecArretrato] = useState(false);
  const [pecGiro, setPecGiro] = useState(0);
  const [pecTotaleArretrato, setPecTotaleArretrato] = useState(0);
  const pecInterrompi = useRef(false);
  const [pecCartelle, setPecCartelle] = useState<{ nome: string; percorso: string; messaggi: number }[] | null>(null);
  const [pecScaricati, setPecScaricati] = useState(0);
  const [pecDiagnosi, setPecDiagnosi] = useState('');
  const [pecPasswordId, setPecPasswordId] = useState('');
  const [pecNuovaPassword, setPecNuovaPassword] = useState('');
  const [pecPwdMsg, setPecPwdMsg] = useState('');
  const pecFormRef = useRef<HTMLFormElement>(null);
  const [abbonamento, setAbbonamento] = useState<Abbonamento | null>(null);
  const [portaleLoading, setPortaleLoading] = useState(false);
  const [mostraPinAdmin, setMostraPinAdmin] = useState(false);
  const [pinAdmin, setPinAdmin] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [adesso, setAdesso] = useState(() => Date.now());

  const [googleAccount, setGoogleAccount] = useState<{ google_email: string; attivo: boolean } | null>(null);
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
    const [{ data: tpl }, { data: s }, letterheadRes, { data: rules }, { data: pec }, { data: studio }, { data: google }] = await Promise.all([
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
      supabase.from('google_calendar_account').select('google_email, attivo').eq('studio_id', studioId).maybeSingle(),
    ]);
    setTemplates(tpl || []);
    setAbbonamento(studio || null);
    setGoogleAccount(google || null);
    if (s) {
      setSettings({ font_family: s.font_family, font_size_pt: s.font_size_pt, line_spacing: s.line_spacing });
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

  /**
   * Cambia solo la password di una casella già inserita.
   *
   * Prima l'unico modo era rimuovere e riaggiungere: quattro campi
   * riscritti per cambiarne uno, e con una password che di solito si
   * sbaglia un paio di volte prima di azzeccarla. Gli altri parametri
   * vengono rimandati identici, perché la route li richiede tutti.
   */
  async function handleCambiaPassword(a: PecAccount) {
    if (!pecNuovaPassword.trim()) return;
    setPecPwdMsg('');
    const res = await fetch('/api/pec/account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: a.id, etichetta: a.etichetta, indirizzo_pec: a.indirizzo_pec,
        imap_host: a.imap_host, imap_port: a.imap_port, imap_user: a.imap_user,
        password: pecNuovaPassword,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: 'Errore' }));
      setPecPwdMsg(b.error || 'Non riuscito');
      return;
    }
    setPecNuovaPassword('');
    setPecPasswordId('');
    setPecPwdMsg('');
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

  // Un cronometro invece di una percentuale: IMAP non dice a che punto è
  // dello scarico, e una barra che finge di sapere quanto manca è peggio
  // di una che dice onestamente «sto lavorando da 40 secondi».
  useEffect(() => {
    if (!pecSincronizzando) return;
    const t = setInterval(() => setPecSecondi((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [pecSincronizzando]);

  async function handleSyncPec() {
    setPecSincronizzando(true);
    setPecSyncMsg('');
    setPecAncora(false);
    setPecSecondi(0);
    try {
      const res = await fetch('/api/pec/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'nuovi' }),
      });
      const body = await res.json();
      if (!res.ok) { setPecSyncMsg(`Errore: ${body.error}`); return; }
      const risultati = (body.risultati || []) as
        { messaggiScaricati: number; restanti?: number; saltati?: number }[];
      const totale = risultati.reduce((s, r) => s + r.messaggiScaricati, 0);
      const saltati = risultati.reduce((s, r) => s + (r.saltati ?? 0), 0);
      // Ora il server dice quante ne restano davvero, invece di farlo
      // dedurre dal fatto che il giro era pieno.
      const ancora = risultati.reduce((s, r) => s + (r.restanti ?? 0), 0);
      setPecAncora(ancora > 0);
      setPecSyncMsg(
        (totale > 0
          ? `${totale} messaggi scaricati${ancora > 0 ? `, altri ${ancora} da prendere.` : '.'}`
          : 'Nessun messaggio nuovo.')
        + (saltati > 0 ? ` ${saltati} non archiviati perché troppo grandi: restano nella webmail.` : ''),
      );
      load();
    } catch {
      setPecSyncMsg('La sincronizzazione si è interrotta. Riprova.');
    } finally {
      setPecSincronizzando(false);
    }
  }

  /**
   * Recupera l'arretrato ripetendo la sincronizzazione fino a esaurimento.
   *
   * Il ciclo sta nel browser e non nel server, e non è un ripiego: ogni
   * giro è una richiesta che finisce per conto suo, quindi il tempo massimo
   * della funzione non viene mai sfiorato, e i messaggi già scaricati
   * restano salvati anche se il giro successivo fallisce. Un ciclo lato
   * server su una casella con anni di arretrato scadrebbe a metà, e
   * ricomincerebbe da capo ogni volta.
   */
  async function handleRecuperaArretrato() {
    setPecArretrato(true);
    pecInterrompi.current = false;
    setPecGiro(0);
    setPecTotaleArretrato(0);
    setPecSyncMsg('');
    let totale = 0;

    // Tetto di sicurezza: 200 giri sono 2.000 messaggi. Serve a non
    // lasciare un ciclo infinito acceso se il server rispondesse sempre
    // "dieci" per un difetto suo.
    for (let giro = 1; giro <= 200 && !pecInterrompi.current; giro++) {
      setPecGiro(giro);
      let risultati: { messaggiScaricati: number; letti?: number; restanti?: number }[] = [];
      try {
        const res = await fetch('/api/pec/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modo: 'arretrato' }),
        });
        const body = await res.json();
        if (!res.ok) { setPecSyncMsg(`Interrotto al giro ${giro}: ${body.error}`); break; }
        risultati = (body.risultati || []) as
          { messaggiScaricati: number; letti?: number; restanti?: number }[];
      } catch {
        setPecSyncMsg(`Interrotto al giro ${giro}: connessione persa. I messaggi già scaricati restano.`);
        break;
      }

      totale += risultati.reduce((s, r) => s + r.messaggiScaricati, 0);
      setPecTotaleArretrato(totale);
      const ancora = risultati.reduce((s, r) => s + (r.restanti ?? 0), 0);
      const letti = risultati.reduce((s, r) => s + (r.letti ?? 0), 0);

      // Ci si ferma su quanti ne ha LETTI il server, non su quanti ne ha
      // inseriti. Durante una rilettura i primi giri ripassano messaggi già
      // presenti: zero inserimenti, ma il lavoro non è finito affatto.
      // Fermarsi lì spegneva il recupero al primo giro.
      if (letti === 0 || ancora === 0) {
        setPecSyncMsg(totale > 0
          ? `Ripasso completato: ${totale} messaggi nuovi in ${giro} giri.`
          : `Ripasso completato in ${giro} giri: non mancava nulla.`);
        setPecAncora(false);
        break;
      }
    }

    if (pecInterrompi.current) {
      setPecSyncMsg(`Fermato: ${totale} messaggi recuperati. Puoi riprendere quando vuoi.`);
    }
    setPecArretrato(false);
    load();
  }

  /**
   * Rilegge la casella da capo.
   *
   * Serve quando dei messaggi sono stati scavalcati e il segnalibro è
   * andato avanti senza di loro. Non crea doppioni: l'unicità su
   * (casella, cartella, uid) fa scartare da sola ciò che c'è già.
   */
  async function handleRileggiTutto() {
    if (!confirm(
      'Rileggere la casella da capo?\n\nServe se qualche messaggio è stato saltato. '
      + 'Non crea doppioni, ma può richiedere parecchi giri se la casella è grande.',
    )) return;
    setPecSincronizzando(true);
    setPecSyncMsg('');
    setPecSecondi(0);
    try {
      const res = await fetch('/api/pec/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'nuovi', azzera: true }),
      });
      const body = await res.json();
      if (!res.ok) { setPecSyncMsg(`Errore: ${body.error}`); return; }
      const risultati = (body.risultati || []) as { messaggiScaricati: number; restanti?: number }[];
      const totale = risultati.reduce((s, r) => s + r.messaggiScaricati, 0);
      setPecAncora(true);
      setPecSyncMsg(`Rilettura avviata: ${totale} messaggi in questo giro. `
        + 'Ora usa «Recupera anche le PEC più vecchie» per ripassare tutta la casella.');
      load();
    } finally {
      setPecSincronizzando(false);
    }
  }

  async function handleCartellePec(id: string) {
    setPecDiagnosi('Lettura delle cartelle...');
    setPecCartelle(null);
    const res = await fetch(`/api/pec/cartelle?id=${id}`);
    const body = await res.json();
    if (!res.ok) { setPecDiagnosi(`Errore: ${body.error}`); return; }
    setPecCartelle(body.cartelle || []);
    setPecScaricati(body.scaricati ?? 0);
    setPecDiagnosi('');
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
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-display font-semibold text-neutral-900">Impostazioni</h1>

      <form onSubmit={handleChangePassword} className="mb-4 rounded-xl bg-neutral-50 p-6">
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
      <div className="mb-4 rounded-xl bg-neutral-50 p-6">
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

      <div className="mb-4 rounded-xl bg-neutral-50 p-6">
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

      <form onSubmit={handleSaveTypography} className="mb-4 rounded-xl bg-neutral-50 p-6">
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

      <form onSubmit={handleSaveAvvocato} className="mb-4 rounded-xl bg-neutral-50 p-6">
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

      <div className="mb-4 rounded-xl bg-neutral-50 p-6">
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

      <div className="mb-4 rounded-xl bg-neutral-50 p-6">
        <h2 className="mb-1 font-semibold text-neutral-900">Google Calendar</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Themis resta il calendario vero — colori, collegamento alla pratica, proposte dalle PEC continuano
          a funzionare solo qui. Se attivo, ogni impegno creato in Themis viene copiato anche sul tuo Google
          Calendar, così lo vedi sul telefono.
        </p>

        {googleMsg && (
          <p className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">{googleMsg}</p>
        )}

        {!googleAccount ? (
          <a
            href="/api/google-calendar/connetti"
            className="premi inline-flex items-center gap-2 rounded-full bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bordeaux-800"
          >
            Collega Google Calendar
          </a>
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
                Ogni impegno importato arriva come tipo &quot;Attività&quot;: Google non distingue un&apos;udienza
                da un appuntamento, quella scelta resta tua.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-xl bg-neutral-50 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Caselle PEC</h2>
          {pecAccounts.length > 0 && (
            <button
              onClick={handleSyncPec} disabled={pecSincronizzando}
              className="premi rounded-full bg-neutral-100 px-3 py-1.5 text-xs hover:bg-neutral-200 disabled:opacity-50"
            >
              {pecSincronizzando ? 'Sincronizzazione...' : 'Scarica le nuove'}
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          La password della PEC non basta più da sola se hai attivato la verifica in due passaggi: serve una
          password dedicata &quot;per programmi di posta&quot;, generata dal pannello del tuo gestore. Non è la
          password con cui accedi alla webmail.
        </p>
        {pecSincronizzando && (
          <div className="mb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full w-1/3 animate-[scorri_1.2s_ease-in-out_infinite] rounded-full bg-bordeaux-700" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Lettura della casella in corso da {pecSecondi}s.
              {pecSecondi > 20 && ' Il primo scarico è il più lento: sta aprendo la casella dall’inizio.'}
              {pecSecondi > 90 && ' Se supera i tre minuti, la funzione scade da sola e potrai riprovare.'}
            </p>
          </div>
        )}
        {pecSyncMsg && (
          <p className="mb-3 text-sm text-neutral-600">
            {pecSyncMsg}
            {pecAncora && !pecArretrato && (
              <span className="ml-1 text-neutral-500">Ce ne sono altri in attesa.</span>
            )}
          </p>
        )}

        {pecDiagnosi && <p className="mb-3 text-sm text-neutral-600">{pecDiagnosi}</p>}
        {pecCartelle && (
          <div className="mb-3 rounded-xl bg-neutral-50 p-3">
            <p className="mb-2 text-xs font-semibold text-neutral-700">
              Cartelle sul server · Themis ne ha archiviati {pecScaricati}
            </p>
            <ul className="space-y-0.5 text-xs text-neutral-600">
              {pecCartelle.map((c) => (
                <li key={c.percorso} className="flex justify-between gap-4">
                  <span className="truncate">{c.nome}<span className="text-neutral-400"> ({c.percorso})</span></span>
                  <span className="shrink-0 tabular-nums">
                    {c.messaggi < 0 ? 'non leggibile' : `${c.messaggi} messaggi`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-neutral-500">
              Themis legge la posta in arrivo, le inviate e gli archivi. Restano fuori
              cestino, indesiderata e bozze: non sono corrispondenza.
            </p>
          </div>
        )}

        {/* Si mostra sempre, non solo dopo una sincronizzazione che abbia
            riportato arretrato: ricaricando la pagina quello stato si perde,
            e il pulsante spariva pur essendoci ancora mezza casella da
            prendere. Se non c'è niente da fare, lo dice premendolo. */}
        {pecAccounts.length > 0 && !pecArretrato && !pecSincronizzando && (
          <button
            type="button" onClick={handleRecuperaArretrato}
            className="premi mb-3 rounded-full bg-bordeaux-700/[0.08] px-4 py-2 text-sm font-semibold text-bordeaux-700 hover:bg-bordeaux-700/[0.14]"
          >
            Completa l&apos;archivio
          </button>
        )}

        {pecArretrato && (
          <div className="mb-3 rounded-xl bg-neutral-50 p-3">
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full w-1/3 animate-[scorri_1.2s_ease-in-out_infinite] rounded-full bg-bordeaux-700" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-600">
                Giro {pecGiro} · {pecTotaleArretrato} messaggi recuperati finora.
                Scende dalle più recenti verso le più vecchie. Puoi lasciare la pagina
                aperta e fare altro.
              </p>
              <button
                type="button" onClick={() => { pecInterrompi.current = true; }}
                className="text-xs text-red-600 hover:underline"
              >
                Ferma
              </button>
            </div>
          </div>
        )}
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

                  {pecPasswordId === a.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="password" autoComplete="new-password"
                        value={pecNuovaPassword}
                        onChange={(e) => setPecNuovaPassword(e.target.value)}
                        placeholder="Password per programmi di posta"
                        className="w-64 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                      />
                      <button
                        type="button" onClick={() => handleCambiaPassword(a)}
                        disabled={!pecNuovaPassword.trim()}
                        className="premi rounded-full bg-bordeaux-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                      >
                        Salva password
                      </button>
                      {pecPwdMsg && <span className="text-xs text-red-600">{pecPwdMsg}</span>}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button" onClick={handleRileggiTutto}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Rileggi da capo
                  </button>
                  <button
                    type="button" onClick={() => handleCartellePec(a.id)}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Cosa c&apos;è sul server
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPecPasswordId(pecPasswordId === a.id ? '' : a.id);
                      setPecNuovaPassword(''); setPecPwdMsg('');
                    }}
                    className="text-xs text-bordeaux-700 hover:underline"
                  >
                    {pecPasswordId === a.id ? 'Annulla' : 'Cambia password'}
                  </button>
                  <button onClick={() => handleDeletePecAccount(a.id)} className="text-xs text-red-600 hover:underline">
                    Rimuovi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form ref={pecFormRef} onSubmit={handleAddPecAccount} className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-neutral-200 pt-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Etichetta (per riconoscerla in elenco)</label>
            <input name="etichetta" required placeholder="Es. PEC studio" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Indirizzo PEC</label>
            <input name="indirizzo_pec" type="email" required placeholder="nome@pec.it" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Gestore (precompila host e porta)</label>
            <select
              defaultValue=""
              onChange={(e) => {
                const g = GESTORI_PEC.find((x) => x.nome === e.target.value);
                if (g) { setPecHost(g.host); setPecPort(g.porta); } else { setPecHost(''); setPecPort(993); }
              }}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            >
              <option value="">Altro (inserisci host manualmente)</option>
              {GESTORI_PEC.map((g) => <option key={g.nome} value={g.nome}>{g.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Host IMAP</label>
            <input
              name="imap_host" required value={pecHost} onChange={(e) => setPecHost(e.target.value)}
              placeholder="imaps.pec.esempio.it" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Porta</label>
            <input
              name="imap_port" type="number" required value={pecPort} onChange={(e) => setPecPort(Number(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Nome utente IMAP</label>
            <input name="imap_user" required placeholder="di solito l'indirizzo PEC stesso" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Password per programmi di posta</label>
            <input name="password" type="password" required autoComplete="new-password" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
          </div>
          {pecFormError && <p className="col-span-2 text-sm text-red-600">{pecFormError}</p>}
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={pecSalvando} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
              {pecSalvando ? 'Salvataggio...' : 'Aggiungi casella'}
            </button>
          </div>
        </form>
      </div>

      <div className="mb-4 rounded-xl bg-neutral-50 p-6">
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

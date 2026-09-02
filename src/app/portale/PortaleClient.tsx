'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toIsoLocale } from '@/lib/dateUtils';
import { useAggiornamentoLive } from '@/lib/useAggiornamentoLive';

const OFFSET_CHOICES: [number, string][] = [
  [15, '15 minuti prima'], [60, '1 ora prima'], [1440, '1 giorno prima'],
  [10080, '1 settimana prima'], [20160, '2 settimane prima'],
];

const LABEL_STATO: Record<string, string> = {
  in_attesa: 'In attesa di conferma', confermato: 'Confermato', rifiutato: 'Rifiutato',
};
const STILE_STATO: Record<string, string> = {
  in_attesa: 'bg-gold-100 text-gold-700', confermato: 'bg-green-100 text-green-700', rifiutato: 'bg-red-100 text-red-700',
};

type Invite = { email: string; nome_cliente: string | null; used: boolean };
type PortalClient = { studio_id: string; nome_cliente: string | null };
type Appointment = { id: string; data: string; ora_inizio: string; ora_fine: string; stato: string };
type AvailabilityRule = { day_of_week: number; start_time: string; end_time: string; slot_minutes: number };
type Slot = { ora: string; occupato: boolean };
type RichiestaDocumento = { id: string; titolo: string; note: string | null; stato: string };

function formattaData(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const giorni = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  return `${giorni[d.getDay()]} ${iso.split('-').reverse().slice(0, 2).join('/')}`;
}

function PortalePageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite');

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [portalClient, setPortalClient] = useState<PortalClient | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [booking, setBooking] = useState(false);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [chosenSlot, setChosenSlot] = useState<{ data: string; ora: string } | null>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [richieste, setRichieste] = useState<RichiestaDocumento[]>([]);
  const [caricando, setCaricando] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSession({ id: user.id });
        const { data: pc } = await supabase.from('portal_clients').select('studio_id, nome_cliente').eq('id', user.id).single();
        setPortalClient(pc);
      } else if (inviteCode) {
        // Via funzione e non lettura diretta della tabella: il codice è un
        // argomento, quindi il database restituisce davvero la sola riga
        // corrispondente. Con una policy la tabella sarebbe interamente
        // leggibile, perché il database non sa che il codice era nel WHERE.
        const { data } = await supabase.rpc('invito_portale', { p_code: inviteCode }).maybeSingle();
        setInvite(data as Invite | null);
      }
      setLoading(false);
    })();
  }, [inviteCode]);

  useEffect(() => {
    if (session && portalClient) { loadAppointments(); loadRichieste(); }
  }, [session, portalClient]);

  // Il cliente vede da solo la conferma di un appuntamento o una nuova
  // richiesta di documenti, senza dover ricaricare.
  useAggiornamentoLive(['appointments', 'document_requests'], () => {
    if (session && portalClient) { loadAppointments(); loadRichieste(); }
  });

  async function loadAppointments() {
    const { data } = await supabase.from('appointments').select('id, data, ora_inizio, ora_fine, stato')
      .eq('portal_client_id', session!.id).in('stato', ['in_attesa', 'confermato', 'rifiutato']).order('data').order('ora_inizio');
    setAppointments(data || []);
  }

  async function loadRichieste() {
    // Il proprio client_id lo risolve il database: portal_clients lo porta
    // già, scritto dal trigger al momento della registrazione.
    const { data: clientId } = await supabase.rpc('cliente_portale_corrente');
    if (!clientId) return;
    const { data } = await supabase.from('document_requests')
      .select('id, titolo, note, stato').eq('client_id', clientId).order('created_at', { ascending: false });
    setRichieste(data || []);
  }

  async function handleCaricaDocumento(richiestaId: string, file: File) {
    setCaricando(richiestaId);
    const form = new FormData();
    form.append('file', file);
    form.append('request_id', richiestaId);
    const res = await fetch('/api/document-requests/upload', { method: 'POST', body: form });
    setCaricando(null);
    if (!res.ok) { const b = await res.json(); setError(b.error || 'Errore caricamento'); return; }
    loadRichieste();
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    if (password.length < 8) { setError('La password deve avere almeno 8 caratteri'); return; }
    const { error: err } = await supabase.auth.signUp({
      email: invite!.email, password, options: { data: { invite_code: inviteCode } },
    });
    if (err) { setError(err.message); return; }
    window.location.href = '/portale';
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: form.get('email') as string, password: form.get('password') as string,
    });
    if (err) { setError('Email o password errati'); return; }
    window.location.href = '/portale';
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/portale';
  }

  async function handleShowSlots() {
    if (!portalClient) return;
    setBooking(true);
    const { data: rules } = await supabase.from('availability_rules').select('*').eq('studio_id', portalClient.studio_id) as { data: AvailabilityRule[] | null };
    const minuti = rules && rules.length > 0 ? rules[0].slot_minutes : 30;
    setSlotMinutes(minuti);
    const today = new Date();
    const from = toIsoLocale(today);
    const to = toIsoLocale(new Date(today.getTime() + 30 * 86400000));
    const { data: taken } = await supabase.rpc('get_taken_slots', { p_studio_id: portalClient.studio_id, p_from: from, p_to: to });
    const takenSet = new Set((taken || []).map((t: { data: string; ora_inizio: string }) => `${t.data}_${t.ora_inizio.slice(0, 5)}`));

    const byDay: Record<string, Slot[]> = {};
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dow = (d.getDay() + 6) % 7;
      const rule = (rules || []).find((r) => r.day_of_week === dow);
      if (!rule) continue;
      const iso = toIsoLocale(d);
      const slots: Slot[] = [];
      let [h, m] = rule.start_time.split(':').map(Number);
      const [endH, endM] = rule.end_time.split(':').map(Number);
      while (h < endH || (h === endH && m < endM)) {
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slots.push({ ora: label, occupato: takenSet.has(`${iso}_${label}`) });
        m += rule.slot_minutes;
        while (m >= 60) { m -= 60; h += 1; }
      }
      if (slots.length > 0) byDay[iso] = slots;
    }
    setSlotsByDay(byDay);
    const primoGiorno = Object.keys(byDay)[0] ?? null;
    setSelectedDay(primoGiorno);
    setBooking(false);
  }

  async function handleConfirmBooking() {
    if (!chosenSlot || !portalClient || !session) return;
    const [h, m] = chosenSlot.ora.split(':').map(Number);
    const endMinutes = h * 60 + m + slotMinutes;
    const oraFine = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    const { error: err } = await supabase.from('appointments').insert({
      studio_id: portalClient.studio_id, portal_client_id: session.id, nome_cliente: portalClient.nome_cliente,
      data: chosenSlot.data, ora_inizio: chosenSlot.ora, ora_fine: oraFine, reminder_offsets_minutes: offsets,
      stato: 'in_attesa',
    });
    if (err) {
      setError(err.code === '23505' ? 'Slot appena occupato da qualcun altro, scegline un altro.' : `Errore: ${err.message}`);
      handleShowSlots();
      return;
    }
    setChosenSlot(null);
    setSlotsByDay({});
    setSelectedDay(null);
    loadAppointments();
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancellare questo appuntamento?')) return;
    await supabase.from('appointments').update({ stato: 'cancellato' }).eq('id', id);
    loadAppointments();
  }

  if (loading) return <div className="p-8 text-sm text-neutral-500">Caricamento...</div>;

  return (
    <div className="min-h-screen bg-neutral-50 p-4">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-1 text-xl font-display font-semibold text-neutral-900">Themis — Portale clienti</h1>
        <p className="mb-6 text-sm text-neutral-500">Gestisci e prenota i tuoi appuntamenti con lo studio.</p>

        {!session && invite && !invite.used && (
          <div className="rounded-xl bg-neutral-50 p-6">
            <h2 className="mb-1 font-semibold">Crea una password</h2>
            <p className="mb-4 text-sm text-neutral-500">Per accedere con <strong>{invite.email}</strong></p>
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <input name="password" type="password" placeholder="Almeno 8 caratteri" className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">Crea account</button>
            </form>
          </div>
        )}

        {!session && invite && invite.used && (
          <div className="rounded-xl bg-neutral-50 p-6">
            <p className="text-sm text-neutral-600">Questo invito è già stato usato. Accedi con le tue credenziali qui sotto.</p>
          </div>
        )}

        {!session && !invite && (
          <div className="rounded-xl bg-neutral-50 p-6">
            <h2 className="mb-4 font-semibold">Accedi</h2>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <input name="email" type="email" placeholder="Email" className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
              <input name="password" type="password" placeholder="Password" className="rounded-lg border border-transparent bg-neutral-50 px-3 py-2 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">Entra</button>
            </form>
          </div>
        )}

        {session && portalClient && (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-neutral-50 p-4">
              <span className="text-sm">Ciao, <strong>{portalClient.nome_cliente}</strong></span>
              <button onClick={handleLogout} className="premi rounded-full bg-neutral-100 px-3 py-1.5 text-xs hover:bg-neutral-200">Esci</button>
            </div>

            <div className="mb-4 rounded-xl bg-neutral-50 p-6">
              <h2 className="mb-3 font-semibold">I tuoi appuntamenti</h2>
              {appointments.length === 0 ? (
                <p className="text-sm text-neutral-500">Nessun appuntamento prenotato.</p>
              ) : (
                <ul className="mb-4 divide-y divide-neutral-100 text-sm">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {a.data.split('-').reverse().join('/')} alle {a.ora_inizio.slice(0, 5)}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${STILE_STATO[a.stato] || 'bg-neutral-100 text-neutral-600'}`}>
                          {LABEL_STATO[a.stato] || a.stato}
                        </span>
                      </span>
                      {a.stato !== 'rifiutato' ? (
                        <button onClick={() => handleCancel(a.id)} className="premi rounded-full bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100">Cancella</button>
                      ) : (
                        <button onClick={() => handleCancel(a.id)} className="premi rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200">Rimuovi</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={handleShowSlots} disabled={booking} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50">
                Prenota un appuntamento
              </button>
            </div>

            {richieste.length > 0 && (
              <div className="mb-4 rounded-xl bg-neutral-50 p-6">
                <h2 className="mb-3 font-semibold">Documenti richiesti dallo studio</h2>
                <ul className="divide-y divide-neutral-100 text-sm">
                  {richieste.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <div className="font-medium text-neutral-800">{r.titolo}</div>
                        {r.note && <div className="text-xs text-neutral-500">{r.note}</div>}
                      </div>
                      {r.stato === 'caricato' ? (
                        <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">Caricato</span>
                      ) : (
                        <label className="premi cursor-pointer whitespace-nowrap rounded-full bg-neutral-100 px-3 py-1.5 text-xs hover:bg-neutral-200">
                          {caricando === r.id ? 'Caricamento...' : 'Carica file'}
                          <input
                            type="file" className="hidden" disabled={caricando !== null}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCaricaDocumento(r.id, f); e.target.value = ''; }}
                          />
                        </label>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(slotsByDay).length > 0 && !chosenSlot && (
              <div className="mb-4 rounded-xl bg-neutral-50 p-6">
                <h2 className="mb-3 font-semibold">Scegli un orario</h2>

                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {Object.keys(slotsByDay).map((iso) => (
                    <button
                      key={iso}
                      onClick={() => setSelectedDay(iso)}
                      className={`flex-shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium ${
                        selectedDay === iso ? 'border-bordeaux-700 bg-bordeaux-700 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {formattaData(iso)}
                    </button>
                  ))}
                </div>

                {selectedDay && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slotsByDay[selectedDay].map((s) => (
                      <button
                        key={s.ora}
                        disabled={s.occupato}
                        onClick={() => setChosenSlot({ data: selectedDay, ora: s.ora })}
                        title={s.occupato ? 'Orario già occupato' : undefined}
                        className={
                          s.occupato
                            ? 'cursor-not-allowed rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-400 line-through'
                            : 'rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-bordeaux-700 hover:bg-bordeaux-700 hover:text-white'
                        }
                      >
                        {s.ora}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-neutral-400">In rosso gli orari già occupati, da un altro appuntamento o dall&apos;agenda dello studio.</p>
              </div>
            )}

            {chosenSlot && (
              <div className="mb-4 rounded-xl bg-neutral-50 p-6">
                <h2 className="mb-1 font-semibold">Conferma appuntamento</h2>
                <p className="mb-4 text-sm text-neutral-600">{chosenSlot.data.split('-').reverse().join('/')} alle {chosenSlot.ora}</p>
                <p className="mb-2 text-xs text-neutral-500">Quando vuoi ricevere il promemoria via email? (puoi sceglierne più di uno)</p>
                <div className="mb-4 space-y-1">
                  {OFFSET_CHOICES.map(([mins, label]) => (
                    <label key={mins} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox" checked={offsets.includes(mins)}
                        onChange={(e) => setOffsets(e.target.checked ? [...offsets, mins] : offsets.filter((o) => o !== mins))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mb-3 rounded-md bg-gold-100 px-3 py-2 text-xs text-gold-700">
                  La richiesta resta in attesa di conferma dello studio: la vedrai confermata (o rifiutata) tra i tuoi appuntamenti.
                </p>
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={handleConfirmBooking} className="premi rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">Invia richiesta</button>
                  <button onClick={() => setChosenSlot(null)} className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm hover:bg-neutral-200">Annulla</button>
                </div>
              </div>
            )}
          </>
        )}

        {session && !portalClient && (
          <p className="text-sm text-red-600">Account non collegato a nessuno studio. Contatta lo studio per un nuovo invito.</p>
        )}
      </div>
    </div>
  );
}

export default function PortaleClient() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Caricamento...</div>}>
      <PortalePageInner />
    </Suspense>
  );
}

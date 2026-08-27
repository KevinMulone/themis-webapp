'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const OFFSET_CHOICES: [number, string][] = [
  [15, '15 minuti prima'], [60, '1 ora prima'], [1440, '1 giorno prima'],
  [10080, '1 settimana prima'], [20160, '2 settimane prima'],
];

type Invite = { email: string; nome_cliente: string | null; used: boolean };
type PortalClient = { studio_id: string; nome_cliente: string | null };
type Appointment = { id: string; data: string; ora_inizio: string; ora_fine: string };
type AvailabilityRule = { day_of_week: number; start_time: string; end_time: string; slot_minutes: number };

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
  const [slotsByDay, setSlotsByDay] = useState<Record<string, string[]>>({});
  const [chosenSlot, setChosenSlot] = useState<{ data: string; ora: string } | null>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSession({ id: user.id });
        const { data: pc } = await supabase.from('portal_clients').select('studio_id, nome_cliente').eq('id', user.id).single();
        setPortalClient(pc);
      } else if (inviteCode) {
        const { data } = await supabase.from('portal_invites').select('email, nome_cliente, used').eq('code', inviteCode).single();
        setInvite(data);
      }
      setLoading(false);
    })();
  }, [inviteCode]);

  useEffect(() => {
    if (session && portalClient) loadAppointments();
  }, [session, portalClient]);

  async function loadAppointments() {
    const { data } = await supabase.from('appointments').select('id, data, ora_inizio, ora_fine')
      .eq('portal_client_id', session!.id).eq('stato', 'prenotato').order('data').order('ora_inizio');
    setAppointments(data || []);
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
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: taken } = await supabase.rpc('get_taken_slots', { p_studio_id: portalClient.studio_id, p_from: from, p_to: to });
    const takenSet = new Set((taken || []).map((t: { data: string; ora_inizio: string }) => `${t.data}_${t.ora_inizio.slice(0, 5)}`));

    const byDay: Record<string, string[]> = {};
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dow = (d.getDay() + 6) % 7;
      const rule = (rules || []).find((r) => r.day_of_week === dow);
      if (!rule) continue;
      const iso = d.toISOString().slice(0, 10);
      const slots: string[] = [];
      let [h, m] = rule.start_time.split(':').map(Number);
      const [endH, endM] = rule.end_time.split(':').map(Number);
      while (h < endH || (h === endH && m < endM)) {
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (!takenSet.has(`${iso}_${label}`)) slots.push(label);
        m += rule.slot_minutes;
        while (m >= 60) { m -= 60; h += 1; }
      }
      if (slots.length > 0) byDay[iso] = slots;
    }
    setSlotsByDay(byDay);
    setBooking(false);
  }

  async function handleConfirmBooking() {
    if (!chosenSlot || !portalClient || !session) return;
    const [h, m] = chosenSlot.ora.split(':').map(Number);
    const endMinutes = h * 60 + m + 30;
    const oraFine = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    const { error: err } = await supabase.from('appointments').insert({
      studio_id: portalClient.studio_id, portal_client_id: session.id, nome_cliente: portalClient.nome_cliente,
      data: chosenSlot.data, ora_inizio: chosenSlot.ora, ora_fine: oraFine, reminder_offsets_minutes: offsets,
    });
    if (err) { setError('Slot appena occupato da qualcun altro, scegline un altro.'); handleShowSlots(); return; }
    setChosenSlot(null);
    setSlotsByDay({});
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
        <h1 className="mb-1 text-xl font-bold text-neutral-900">Themis — Portale clienti</h1>
        <p className="mb-6 text-sm text-neutral-500">Gestisci e prenota i tuoi appuntamenti con lo studio.</p>

        {!session && invite && !invite.used && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 font-semibold">Crea una password</h2>
            <p className="mb-4 text-sm text-neutral-500">Per accedere con <strong>{invite.email}</strong></p>
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <input name="password" type="password" placeholder="Almeno 8 caratteri" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">Crea account</button>
            </form>
          </div>
        )}

        {!session && invite && invite.used && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-600">Questo invito è già stato usato. Accedi con le tue credenziali qui sotto.</p>
          </div>
        )}

        {!session && !invite && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold">Accedi</h2>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <input name="email" type="email" placeholder="Email" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              <input name="password" type="password" placeholder="Password" className="rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">Entra</button>
            </form>
          </div>
        )}

        {session && portalClient && (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <span className="text-sm">Ciao, <strong>{portalClient.nome_cliente}</strong></span>
              <button onClick={handleLogout} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50">Esci</button>
            </div>

            <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 font-semibold">I tuoi appuntamenti</h2>
              {appointments.length === 0 ? (
                <p className="text-sm text-neutral-500">Nessun appuntamento prenotato.</p>
              ) : (
                <ul className="mb-4 divide-y divide-neutral-100 text-sm">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <span>{a.data.split('-').reverse().join('/')} alle {a.ora_inizio.slice(0, 5)}</span>
                      <button onClick={() => handleCancel(a.id)} className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50">Cancella</button>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={handleShowSlots} disabled={booking} className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50">
                Prenota un appuntamento
              </button>
            </div>

            {Object.keys(slotsByDay).length > 0 && !chosenSlot && (
              <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 font-semibold">Scegli un orario</h2>
                {Object.entries(slotsByDay).map(([iso, slots]) => (
                  <div key={iso} className="mb-3">
                    <div className="mb-1 text-xs font-semibold text-neutral-500">{iso.split('-').reverse().join('/')}</div>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <button key={s} onClick={() => setChosenSlot({ data: iso, ora: s })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {chosenSlot && (
              <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
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
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={handleConfirmBooking} className="rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">Prenota</button>
                  <button onClick={() => setChosenSlot(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">Annulla</button>
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

export default function PortalePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Caricamento...</div>}>
      <PortalePageInner />
    </Suspense>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TIPI_EVENTO, labelFromOptions, clientLabel } from '@/lib/constants';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const GIORNI_LUNGHI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

type Vista = 'giorno' | 'settimana' | 'mese';

type Evento = {
  id: string; matter_id: string | null; titolo: string; tipo: string;
  data: string; ora_inizio: string | null; ora_fine: string | null;
  all_day: boolean; luogo: string | null; note: string | null;
};
type Matter = { id: string; client_id: string; tipo_pratica: string; clients?: { nome: string | null; cognome: string | null; ragione_sociale: string | null; tipo_soggetto: string } };
type Appointment = { id: string; data: string; ora_inizio: string; ora_fine: string; nome_cliente: string | null; stato: string };
type AvailabilityRule = { day_of_week: number; start_time: string; end_time: string; slot_minutes: number };

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inizioSettimana(d: Date): Date {
  const offset = (d.getDay() + 6) % 7; // 0 = lunedì
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - offset);
  return r;
}

function generaRigheOrarie(rules: AvailabilityRule[]): string[] {
  if (rules.length === 0) return [];
  const aMinuti = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const minStart = Math.min(...rules.map((r) => aMinuti(r.start_time)));
  const maxEnd = Math.max(...rules.map((r) => aMinuti(r.end_time)));
  const step = rules[0].slot_minutes || 30;
  const righe: string[] = [];
  for (let m = minStart; m < maxEnd; m += step) {
    righe.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return righe;
}

function rigaDiOra(oraInizio: string, righe: string[]): string {
  const t = oraInizio.slice(0, 5);
  let scelta = righe[0];
  for (const r of righe) { if (r <= t) scelta = r; else break; }
  return scelta;
}

export default function CalendarioPage() {
  const supabase = createClient();
  const today = new Date();
  const [vista, setVista] = useState<Vista>('settimana');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12, per la vista mese
  const [cursore, setCursore] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate())); // giorno di riferimento per giorno/settimana
  const [events, setEvents] = useState<Evento[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [formTime, setFormTime] = useState('');
  const [detail, setDetail] = useState<Evento | null>(null);
  const [appointmentDetail, setAppointmentDetail] = useState<Appointment | null>(null);

  async function load() {
    let from: string, to: string;
    if (vista === 'mese') {
      from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (vista === 'settimana') {
      const inizio = inizioSettimana(cursore);
      const fine = new Date(inizio); fine.setDate(inizio.getDate() + 6);
      from = toIso(inizio); to = toIso(fine);
    } else {
      from = toIso(cursore); to = toIso(cursore);
    }
    const [{ data }, { data: appts }, { data: m }, { data: rules }] = await Promise.all([
      supabase.from('eventi').select('*').gte('data', from).lte('data', to).order('data').order('ora_inizio'),
      supabase.from('appointments').select('id, data, ora_inizio, ora_fine, nome_cliente, stato')
        .gte('data', from).lte('data', to).in('stato', ['in_attesa', 'confermato']).order('data').order('ora_inizio'),
      supabase.from('matters').select('id, client_id, tipo_pratica, clients(nome, cognome, ragione_sociale, tipo_soggetto)').neq('stato', 'archiviata'),
      supabase.from('availability_rules').select('day_of_week, start_time, end_time, slot_minutes'),
    ]);
    setEvents(data || []);
    setAppointments(appts || []);
    setMatters((m as unknown as Matter[]) || []);
    setAvailabilityRules((rules as AvailabilityRule[]) || []);
  }

  useEffect(() => { load(); }, [year, month, vista, cursore]);

  function changeMonth(delta: number) {
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m); setYear(y);
  }

  function vai(delta: number) {
    if (vista === 'mese') { changeMonth(delta); return; }
    const nuovo = new Date(cursore);
    nuovo.setDate(cursore.getDate() + delta * (vista === 'settimana' ? 7 : 1));
    setCursore(nuovo);
  }

  function vaiOggi() {
    const t = new Date();
    setCursore(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
    setYear(t.getFullYear()); setMonth(t.getMonth() + 1);
  }

  function etichettaPeriodo(): string {
    if (vista === 'mese') return `${MESI[month - 1]} ${year}`;
    if (vista === 'giorno') return `${GIORNI_LUNGHI[(cursore.getDay() + 6) % 7]} ${cursore.getDate()} ${MESI[cursore.getMonth()]} ${cursore.getFullYear()}`;
    const inizio = inizioSettimana(cursore);
    const fine = new Date(inizio); fine.setDate(inizio.getDate() + 6);
    return `${inizio.getDate()} - ${fine.getDate()} ${MESI[fine.getMonth()]} ${fine.getFullYear()}`;
  }

  const eventsByDay: Record<string, Evento[]> = {};
  events.forEach((ev) => { (eventsByDay[ev.data] ||= []).push(ev); });
  const appointmentsByDay: Record<string, Appointment[]> = {};
  appointments.forEach((a) => { (appointmentsByDay[a.data] ||= []).push(a); });

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const cells: { date: Date; otherMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: new Date(year, month - 1, 1 - (startWeekday - i)), otherMonth: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month - 1, d), otherMonth: false });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), otherMonth: true });
  }
  const todayIso = toIso(today);

  const giorniVista = vista === 'giorno' ? [cursore] : Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inizioSettimana(cursore)); d.setDate(d.getDate() + i); return d;
  });
  const righeOrarie = generaRigheOrarie(availabilityRules);

  function apriNuovoEvento(iso: string, ora: string) {
    setFormDate(iso);
    setFormTime(ora);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const tipo = form.get('tipo') as string;
    const allDay = tipo === 'ferie';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: Record<string, unknown> = {
      studio_id: user.id,
      titolo: form.get('titolo'),
      tipo,
      data: form.get('data'),
      ora_inizio: allDay ? null : (form.get('ora_inizio') || null),
      ora_fine: allDay ? null : (form.get('ora_fine') || null),
      all_day: allDay,
      luogo: form.get('luogo') || null,
      note: form.get('note') || null,
      matter_id: form.get('matter_id') || null,
    };
    if (!allDay && !payload.ora_inizio) { alert("L'orario di inizio è obbligatorio (salvo evento di tipo ferie)"); return; }
    await supabase.from('eventi').insert(payload);
    setFormDate(null);
    setFormTime('');
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo evento?')) return;
    await supabase.from('eventi').delete().eq('id', id);
    setDetail(null);
    load();
  }

  async function handleUpdateAppointment(id: string, stato: string) {
    const { error } = await supabase.from('appointments').update({ stato }).eq('id', id);
    if (error) { alert(error.message); return; }
    setAppointmentDetail(null);
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-display font-semibold text-neutral-900">Calendario</h1>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => vai(-1)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">« Precedente</button>
        <h2 className="text-center text-lg font-semibold">{etichettaPeriodo()}</h2>
        <div className="flex gap-2">
          <button onClick={vaiOggi} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">Oggi</button>
          <button onClick={() => vai(1)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">Successivo »</button>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(['giorno', 'settimana', 'mese'] as Vista[]).map((v) => (
          <button
            key={v} onClick={() => setVista(v)}
            className={`rounded-md border px-3 py-1.5 text-sm ${vista === v ? 'border-bordeaux-700 bg-bordeaux-700 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            {v === 'giorno' ? 'Giorno' : v === 'settimana' ? 'Settimana' : 'Mese'}
          </button>
        ))}
      </div>

      {vista === 'mese' && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
          <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden bg-neutral-200">
            {GIORNI.map((g) => (
              <div key={g} className="bg-neutral-50 px-2 py-1 text-center text-xs font-semibold text-neutral-500">{g}</div>
            ))}
            {cells.map((c, i) => {
              const iso = toIso(c.date);
              const dayEvents = eventsByDay[iso] || [];
              const dayAppointments = appointmentsByDay[iso] || [];
              return (
                <div
                  key={i}
                  onClick={() => apriNuovoEvento(iso, '')}
                  className={`min-h-24 cursor-pointer bg-white p-1.5 text-xs ${c.otherMonth ? 'opacity-40' : ''} ${iso === todayIso ? 'ring-2 ring-inset ring-gold-500' : ''}`}
                >
                  <div className="mb-1 font-semibold">{c.date.getDate()}</div>
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); setDetail(ev); }}
                      className="mb-1 truncate rounded bg-gold-100 px-1 py-0.5 text-bordeaux-800"
                      title={ev.titolo}
                    >
                      {!ev.all_day && ev.ora_inizio && `${ev.ora_inizio.slice(0, 5)} `}{ev.titolo}
                    </div>
                  ))}
                  {dayAppointments.map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); setAppointmentDetail(a); }}
                      className={`mb-1 truncate rounded px-1 py-0.5 ${a.stato === 'in_attesa' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}
                      title={`${a.stato === 'in_attesa' ? 'In attesa: ' : ''}${a.nome_cliente || 'Prenotazione'}`}
                    >
                      {a.ora_inizio.slice(0, 5)} {a.stato === 'in_attesa' ? '? ' : ''}{a.nome_cliente || 'Prenotazione'}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(vista === 'settimana' || vista === 'giorno') && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
          <div style={{ minWidth: vista === 'giorno' ? '320px' : '700px' }}>
            <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: `56px repeat(${giorniVista.length}, 1fr)` }}>
              <div />
              {giorniVista.map((d) => {
                const iso = toIso(d);
                const rule = availabilityRules.find((r) => r.day_of_week === (d.getDay() + 6) % 7);
                return (
                  <div key={iso} className={`border-l border-neutral-100 px-1 py-2 text-center text-xs font-semibold ${iso === todayIso ? 'text-bordeaux-800' : 'text-neutral-600'}`}>
                    {GIORNI[(d.getDay() + 6) % 7]} {d.getDate()}
                    {!rule && <div className="text-[10px] font-normal text-neutral-400">chiuso</div>}
                  </div>
                );
              })}
            </div>

            {righeOrarie.length === 0 ? (
              <p className="p-6 text-sm text-neutral-500">
                Nessun orario di disponibilità configurato: vai in Impostazioni per impostare gli orari di apertura e vedere qui le fasce orarie.
              </p>
            ) : (
              righeOrarie.map((ora) => (
                <div key={ora} className="grid border-b border-neutral-100" style={{ gridTemplateColumns: `56px repeat(${giorniVista.length}, 1fr)` }}>
                  <div className="px-1 py-1 text-right text-[10px] text-neutral-400">{ora}</div>
                  {giorniVista.map((d) => {
                    const iso = toIso(d);
                    const rule = availabilityRules.find((r) => r.day_of_week === (d.getDay() + 6) % 7);
                    const fuoriOrario = !rule || ora < rule.start_time.slice(0, 5) || ora >= rule.end_time.slice(0, 5);
                    const slotEventi = (eventsByDay[iso] || []).filter((ev) => !ev.all_day && ev.ora_inizio && rigaDiOra(ev.ora_inizio, righeOrarie) === ora);
                    const slotApp = (appointmentsByDay[iso] || []).filter((a) => rigaDiOra(a.ora_inizio, righeOrarie) === ora);
                    return (
                      <div
                        key={iso}
                        onClick={() => apriNuovoEvento(iso, ora)}
                        className={`min-h-10 cursor-pointer border-l border-neutral-100 p-0.5 ${fuoriOrario ? 'bg-neutral-50 hover:bg-neutral-100' : 'bg-white hover:bg-gold-50'}`}
                      >
                        {slotEventi.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); setDetail(ev); }}
                            className="mb-0.5 truncate rounded bg-gold-100 px-1 py-0.5 text-[11px] text-bordeaux-800"
                            title={ev.titolo}
                          >
                            {ev.ora_inizio?.slice(0, 5)} {ev.titolo}
                          </div>
                        ))}
                        {slotApp.map((a) => (
                          <div
                            key={a.id}
                            onClick={(e) => { e.stopPropagation(); setAppointmentDetail(a); }}
                            className={`mb-0.5 truncate rounded px-1 py-0.5 text-[11px] ${a.stato === 'in_attesa' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}
                            title={`${a.stato === 'in_attesa' ? 'In attesa: ' : ''}${a.nome_cliente || 'Prenotazione'}`}
                          >
                            {a.ora_inizio.slice(0, 5)} {a.stato === 'in_attesa' ? '? ' : ''}{a.nome_cliente || 'Prenotazione'}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {formDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">Nuovo evento</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <input type="hidden" name="data" value={formDate} />
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Titolo</label>
                <input name="titolo" required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Tipo</label>
                <select name="tipo" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  {TIPI_EVENTO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Pratica collegata (opzionale)</label>
                <select name="matter_id" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  <option value="">Nessuna</option>
                  {matters.map((m) => <option key={m.id} value={m.id}>{clientLabel(m.clients)} - {m.tipo_pratica}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Ora inizio</label>
                  <input type="time" name="ora_inizio" step={1800} defaultValue={formTime} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Ora fine</label>
                  <input type="time" name="ora_fine" step={1800} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Luogo</label>
                <input name="luogo" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Note</label>
                <textarea name="note" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              </div>
              <div className="mt-2 flex justify-end gap-2 border-t border-neutral-200 pt-4">
                <button type="button" onClick={() => { setFormDate(null); setFormTime(''); }} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">Annulla</button>
                <button type="submit" className="rounded-md bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">{detail.titolo}</h2>
            <div className="space-y-1 text-sm text-neutral-700">
              <p><strong>Data:</strong> {detail.data}</p>
              <p><strong>Ora:</strong> {detail.all_day ? 'Tutto il giorno' : `${detail.ora_inizio || ''} - ${detail.ora_fine || ''}`}</p>
              <p><strong>Tipo:</strong> {labelFromOptions(TIPI_EVENTO, detail.tipo)}</p>
              <p><strong>Luogo:</strong> {detail.luogo || '-'}</p>
              <p><strong>Note:</strong> {detail.note || '-'}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-neutral-200 pt-4">
              <button onClick={() => handleDelete(detail.id)} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">Elimina</button>
              <button onClick={() => setDetail(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {appointmentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">Prenotazione online</h2>
            <div className="space-y-1 text-sm text-neutral-700">
              <p><strong>Cliente:</strong> {appointmentDetail.nome_cliente || '-'}</p>
              <p><strong>Data:</strong> {appointmentDetail.data}</p>
              <p><strong>Ora:</strong> {appointmentDetail.ora_inizio.slice(0, 5)} - {appointmentDetail.ora_fine.slice(0, 5)}</p>
              <p><strong>Stato:</strong> {appointmentDetail.stato === 'in_attesa' ? 'In attesa di conferma' : 'Confermato'}</p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
              {appointmentDetail.stato === 'in_attesa' ? (
                <>
                  <button onClick={() => handleUpdateAppointment(appointmentDetail.id, 'rifiutato')} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">Rifiuta</button>
                  <button onClick={() => handleUpdateAppointment(appointmentDetail.id, 'confermato')} className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Accetta</button>
                </>
              ) : (
                <button onClick={() => handleUpdateAppointment(appointmentDetail.id, 'cancellato')} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">Annulla appuntamento</button>
              )}
              <button onClick={() => setAppointmentDetail(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

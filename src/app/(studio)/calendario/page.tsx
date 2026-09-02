'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useStudio } from '@/lib/studio/StudioProvider';
import { TIPI_EVENTO, labelFromOptions, clientLabel } from '@/lib/constants';
import { Icon } from '@/components/ui/Icon';

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

/**
 * Un colore per famiglia di evento.
 *
 * Prima erano tutti dello stesso oro: in una settimana piena non si
 * distingueva un'udienza da un appuntamento senza leggerli uno per uno.
 * Il colore qui non decora, è la prima informazione che arriva all'occhio.
 *
 * Le classi sono scritte per intero perché Tailwind include nel foglio di
 * stile solo ciò che trova scritto così nel sorgente.
 */
const COLORI: Record<string, { punto: string; blocco: string; testo: string; tessera: string }> = {
  udienza: { punto: 'bg-rose-500', blocco: 'bg-rose-50 border-rose-200', testo: 'text-rose-700', tessera: 'bg-rose-50 text-rose-500' },
  scadenza: { punto: 'bg-violet-500', blocco: 'bg-violet-50 border-violet-200', testo: 'text-violet-700', tessera: 'bg-violet-50 text-violet-500' },
  termine_processuale: { punto: 'bg-violet-500', blocco: 'bg-violet-50 border-violet-200', testo: 'text-violet-700', tessera: 'bg-violet-50 text-violet-500' },
  appuntamento: { punto: 'bg-emerald-500', blocco: 'bg-emerald-50 border-emerald-200', testo: 'text-emerald-700', tessera: 'bg-emerald-50 text-emerald-500' },
  ferie: { punto: 'bg-sky-500', blocco: 'bg-sky-50 border-sky-200', testo: 'text-sky-700', tessera: 'bg-sky-50 text-sky-500' },
  altro: { punto: 'bg-amber-500', blocco: 'bg-amber-50 border-amber-200', testo: 'text-amber-700', tessera: 'bg-amber-50 text-amber-500' },
};
const COLORE_PREDEFINITO = COLORI.altro;
function colore(tipo: string) { return COLORI[tipo] ?? COLORE_PREDEFINITO; }

/** Le voci della legenda: raggruppano i sette tipi in cinque famiglie. */
const LEGENDA: { chiave: string; etichetta: string; tipi: string[] }[] = [
  { chiave: 'udienza', etichetta: 'Udienze', tipi: ['udienza'] },
  { chiave: 'scadenza', etichetta: 'Scadenze', tipi: ['scadenza', 'termine_processuale'] },
  { chiave: 'appuntamento', etichetta: 'Appuntamenti', tipi: ['appuntamento'] },
  { chiave: 'altro', etichetta: 'Attività', tipi: ['altro'] },
  { chiave: 'ferie', etichetta: 'Ferie', tipi: ['ferie'] },
];

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

/** «oggi», «domani», «Mer 3 set» — come lo diresti a voce. */
function quandoLabel(iso: string, oggiIso: string): string {
  const d = new Date(iso);
  const diff = Math.round((new Date(iso).getTime() - new Date(oggiIso).getTime()) / 86400000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  if (diff < 0) return `${Math.abs(diff)}gg fa`;
  return `${GIORNI[(d.getDay() + 6) % 7]} ${d.getDate()} ${MESI[d.getMonth()].slice(0, 3).toLowerCase()}`;
}

export default function CalendarioPage() {
  const supabase = createClient();
  const { studioId } = useStudio();
  const today = new Date();
  const [vista, setVista] = useState<Vista>('settimana');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12, per la vista mese
  const [cursore, setCursore] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState<Evento[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [formTime, setFormTime] = useState('');
  const [detail, setDetail] = useState<Evento | null>(null);
  const [appointmentDetail, setAppointmentDetail] = useState<Appointment | null>(null);

  // Il pannello di destra guarda avanti nel tempo, non al periodo mostrato:
  // serve a sapere cosa arriva, e va caricato a parte.
  const [prossimi, setProssimi] = useState<Evento[]>([]);
  // Mese del calendarietto laterale, indipendente dalla vista principale.
  const [miniAnno, setMiniAnno] = useState(today.getFullYear());
  const [miniMese, setMiniMese] = useState(today.getMonth() + 1);
  const [tipiNascosti, setTipiNascosti] = useState<string[]>([]);

  const todayIso = toIso(today);

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
    const fra30 = new Date(today); fra30.setDate(fra30.getDate() + 30);

    const [{ data }, { data: appts }, { data: m }, { data: rules }, { data: pross }] = await Promise.all([
      supabase.from('eventi').select('*').gte('data', from).lte('data', to).order('data').order('ora_inizio'),
      supabase.from('appointments').select('id, data, ora_inizio, ora_fine, nome_cliente, stato')
        .gte('data', from).lte('data', to).in('stato', ['in_attesa', 'confermato']).order('data').order('ora_inizio'),
      supabase.from('matters').select('id, client_id, tipo_pratica, clients(nome, cognome, ragione_sociale, tipo_soggetto)').neq('stato', 'archiviata'),
      supabase.from('availability_rules').select('day_of_week, start_time, end_time, slot_minutes'),
      supabase.from('eventi').select('*')
        .gte('data', todayIso).lte('data', toIso(fra30))
        .order('data').order('ora_inizio').limit(8),
    ]);
    setEvents(data || []);
    setAppointments(appts || []);
    setMatters((m as unknown as Matter[]) || []);
    setAvailabilityRules((rules as AvailabilityRule[]) || []);
    setProssimi(pross || []);
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
    setMiniAnno(t.getFullYear()); setMiniMese(t.getMonth() + 1);
  }

  /** Salta a un giorno preciso dal calendarietto o da "Prossimi eventi". */
  function vaiAlGiorno(iso: string) {
    const d = new Date(iso);
    setCursore(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
    if (vista === 'mese') return;
    setVista('giorno');
  }

  function etichettaPeriodo(): string {
    if (vista === 'mese') return `${MESI[month - 1]} ${year}`;
    if (vista === 'giorno') return `${GIORNI_LUNGHI[(cursore.getDay() + 6) % 7]} ${cursore.getDate()} ${MESI[cursore.getMonth()]} ${cursore.getFullYear()}`;
    const inizio = inizioSettimana(cursore);
    const fine = new Date(inizio); fine.setDate(inizio.getDate() + 6);
    return `${inizio.getDate()} ${MESI[inizio.getMonth()].slice(0, 3)} – ${fine.getDate()} ${MESI[fine.getMonth()]} ${fine.getFullYear()}`;
  }

  function tipoVisibile(tipo: string) {
    return !tipiNascosti.includes(tipo);
  }

  /** Accende e spegne una famiglia della legenda. */
  function alternaFamiglia(tipi: string[]) {
    const spenta = tipi.every((t) => tipiNascosti.includes(t));
    setTipiNascosti((n) => spenta
      ? n.filter((t) => !tipi.includes(t))
      : [...new Set([...n, ...tipi])]);
  }

  const eventiVisibili = events.filter((e) => tipoVisibile(e.tipo));

  const eventsByDay: Record<string, Evento[]> = {};
  eventiVisibili.forEach((ev) => { (eventsByDay[ev.data] ||= []).push(ev); });
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

  const giorniVista = vista === 'giorno' ? [cursore] : Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inizioSettimana(cursore)); d.setDate(d.getDate() + i); return d;
  });
  const righeOrarie = generaRigheOrarie(availabilityRules);

  // Calendarietto laterale
  const miniPrimo = new Date(miniAnno, miniMese - 1, 1);
  const miniGiorni = new Date(miniAnno, miniMese, 0).getDate();
  const miniOffset = (miniPrimo.getDay() + 6) % 7;
  const miniCelle: (Date | null)[] = [
    ...Array.from({ length: miniOffset }, () => null),
    ...Array.from({ length: miniGiorni }, (_, i) => new Date(miniAnno, miniMese - 1, i + 1)),
  ];

  function cambiaMiniMese(delta: number) {
    let m = miniMese + delta, y = miniAnno;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMiniMese(m); setMiniAnno(y);
  }

  // Le scadenze che premono: solo termini e scadenze, entro una settimana.
  const inScadenza = prossimi.filter((e) => {
    if (!['scadenza', 'termine_processuale'].includes(e.tipo)) return false;
    const giorni = Math.round((new Date(e.data).getTime() - new Date(todayIso).getTime()) / 86400000);
    return giorni >= 0 && giorni <= 7;
  });

  function apriNuovoEvento(iso: string, ora: string) {
    setFormDate(iso);
    setFormTime(ora);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const tipo = form.get('tipo') as string;
    const allDay = tipo === 'ferie';
    const payload: Record<string, unknown> = {
      studio_id: studioId,
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
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-neutral-900">Calendario</h1>
          <p className="mt-1 text-sm text-neutral-500">Organizza udienze, scadenze e attività dello studio.</p>
        </div>
        <button
          onClick={() => apriNuovoEvento(toIso(cursore), '')}
          className="flex items-center gap-2 premi rounded-full bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bordeaux-800"
        >
          <Icon nome="piu" className="h-4 w-4" />
          Nuovo evento
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <div className="mb-4 rounded-2xl bg-neutral-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => vai(-1)} aria-label="Periodo precedente"
                  className="premi rounded-full bg-neutral-100 px-2.5 py-2 text-neutral-600 hover:bg-neutral-200"
                >
                  <Icon nome="freccia" className="h-4 w-4 rotate-180" />
                </button>
                <button
                  onClick={() => vai(1)} aria-label="Periodo successivo"
                  className="premi rounded-full bg-neutral-100 px-2.5 py-2 text-neutral-600 hover:bg-neutral-200"
                >
                  <Icon nome="freccia" className="h-4 w-4" />
                </button>
                <button
                  onClick={vaiOggi}
                  className="premi rounded-full bg-neutral-100 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
                >
                  Oggi
                </button>
                <h2 className="ml-2 text-base font-semibold text-neutral-900">{etichettaPeriodo()}</h2>
              </div>

              <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
                {(['giorno', 'settimana', 'mese'] as Vista[]).map((v) => (
                  <button
                    key={v} onClick={() => setVista(v)}
                    className={`premi rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      vista === v ? 'bg-bordeaux-700 text-white' : 'text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {v === 'giorno' ? 'Giorno' : v === 'settimana' ? 'Settimana' : 'Mese'}
                  </button>
                ))}
              </div>
            </div>

            {/* La legenda non è una didascalia: ogni voce accende e spegne la
                propria famiglia. In una settimana piena è il modo più veloce
                per guardare solo le udienze. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
              {LEGENDA.map((f) => {
                const spenta = f.tipi.every((t) => tipiNascosti.includes(t));
                return (
                  <button
                    key={f.chiave}
                    type="button"
                    onClick={() => alternaFamiglia(f.tipi)}
                    aria-pressed={!spenta}
                    title={spenta ? 'Mostra' : 'Nascondi'}
                    className={`premi flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      spenta
                        ? 'bg-neutral-100 text-neutral-400'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${spenta ? 'bg-neutral-300' : colore(f.chiave).punto}`} />
                    {f.etichetta}
                  </button>
                );
              })}
              {tipiNascosti.length > 0 && (
                <button
                  type="button" onClick={() => setTipiNascosti([])}
                  className="text-xs font-medium text-bordeaux-700 hover:underline"
                >
                  Mostra tutti
                </button>
              )}
            </div>
          </div>

          {vista === 'mese' && (
            <div className="overflow-x-auto rounded-2xl bg-neutral-50">
              <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden bg-neutral-200">
                {GIORNI.map((g) => (
                  <div key={g} className="bg-neutral-50 px-2 py-2 text-center text-xs font-semibold text-neutral-500">{g}</div>
                ))}
                {cells.map((c, i) => {
                  const iso = toIso(c.date);
                  const dayEvents = eventsByDay[iso] || [];
                  const dayAppointments = appointmentsByDay[iso] || [];
                  return (
                    <div
                      key={i}
                      onClick={() => apriNuovoEvento(iso, '')}
                      className={`min-h-24 min-w-0 cursor-pointer overflow-hidden bg-white p-1.5 text-xs ${c.otherMonth ? 'opacity-40' : ''} ${iso === todayIso ? 'ring-2 ring-inset ring-bordeaux-700' : ''}`}
                    >
                      <div className={`mb-1 font-semibold ${iso === todayIso ? 'text-bordeaux-700' : 'text-neutral-700'}`}>
                        {c.date.getDate()}
                      </div>
                      {dayEvents.map((ev) => {
                        const col = colore(ev.tipo);
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); setDetail(ev); }}
                            className={`mb-1 min-w-0 truncate rounded border px-1 py-0.5 ${col.blocco} ${col.testo}`}
                            title={ev.titolo}
                          >
                            {!ev.all_day && ev.ora_inizio && `${ev.ora_inizio.slice(0, 5)} `}{ev.titolo}
                          </div>
                        );
                      })}
                      {dayAppointments.map((a) => (
                        <div
                          key={a.id}
                          onClick={(e) => { e.stopPropagation(); setAppointmentDetail(a); }}
                          className={`mb-1 min-w-0 truncate rounded border px-1 py-0.5 ${a.stato === 'in_attesa' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                          title={`${a.stato === 'in_attesa' ? 'In attesa: ' : ''}${a.nome_cliente || 'Prenotazione'}`}
                        >
                          {a.ora_inizio.slice(0, 5)} {a.stato === 'in_attesa' ? '· ' : ''}{a.nome_cliente || 'Prenotazione'}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(vista === 'settimana' || vista === 'giorno') && (
            <div className="overflow-x-auto rounded-2xl bg-neutral-50">
              <div style={{ minWidth: vista === 'giorno' ? '320px' : '700px' }}>
                <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: `56px repeat(${giorniVista.length}, 1fr)` }}>
                  <div />
                  {giorniVista.map((d) => {
                    const iso = toIso(d);
                    const rule = availabilityRules.find((r) => r.day_of_week === (d.getDay() + 6) % 7);
                    return (
                      <button
                        key={iso}
                        onClick={() => vaiAlGiorno(iso)}
                        className={`border-l border-neutral-100 px-1 py-2.5 text-center text-xs font-semibold transition-colors hover:bg-neutral-50 ${iso === todayIso ? 'text-bordeaux-700' : 'text-neutral-600'}`}
                      >
                        <span className="block">{GIORNI[(d.getDay() + 6) % 7]} {d.getDate()}</span>
                        <span className="block text-[10px] font-normal text-neutral-400">
                          {MESI[d.getMonth()].slice(0, 3)}
                        </span>
                        {!rule && <span className="block text-[10px] font-normal text-neutral-400">Chiuso</span>}
                      </button>
                    );
                  })}
                </div>

                {righeOrarie.length === 0 ? (
                  <div className="p-8 text-center">
                    <Icon nome="orologio" className="mx-auto h-9 w-9 text-neutral-200" />
                    <p className="mx-auto mt-3 max-w-sm text-sm text-neutral-500">
                      Nessun orario di apertura impostato: senza, le fasce orarie non si possono disegnare.
                    </p>
                    <Link
                      href="/impostazioni"
                      className="mt-3 inline-flex items-center gap-2 premi rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 hover:text-bordeaux-700"
                    >
                      <Icon nome="impostazioni" className="h-4 w-4" />
                      Imposta gli orari dello studio
                    </Link>
                  </div>
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
                            className={`min-h-11 min-w-0 cursor-pointer overflow-hidden border-l border-neutral-100 p-0.5 ${fuoriOrario ? 'bg-neutral-50 hover:bg-neutral-100' : 'bg-white hover:bg-bordeaux-50'}`}
                          >
                            {slotEventi.map((ev) => {
                              const col = colore(ev.tipo);
                              return (
                                <div
                                  key={ev.id}
                                  onClick={(e) => { e.stopPropagation(); setDetail(ev); }}
                                  className={`mb-0.5 min-w-0 rounded border p-1 text-[11px] leading-tight ${col.blocco}`}
                                  title={ev.titolo}
                                >
                                  <span className={`block font-semibold ${col.testo}`}>
                                    {ev.ora_inizio?.slice(0, 5)}
                                  </span>
                                  <span className={`block truncate font-medium ${col.testo}`}>
                                    {labelFromOptions(TIPI_EVENTO, ev.tipo)}
                                  </span>
                                  <span className="block truncate text-neutral-600">{ev.titolo}</span>
                                </div>
                              );
                            })}
                            {slotApp.map((a) => (
                              <div
                                key={a.id}
                                onClick={(e) => { e.stopPropagation(); setAppointmentDetail(a); }}
                                className={`mb-0.5 min-w-0 truncate rounded border px-1 py-0.5 text-[11px] ${a.stato === 'in_attesa' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                                title={`${a.stato === 'in_attesa' ? 'In attesa: ' : ''}${a.nome_cliente || 'Prenotazione'}`}
                              >
                                {a.ora_inizio.slice(0, 5)} {a.nome_cliente || 'Prenotazione'}
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

          {inScadenza.length > 0 && (
            <div className="mt-4 rounded-2xl bg-neutral-50 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold text-neutral-900">
                  Scadenze imminenti
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    {inScadenza.length}
                  </span>
                </h3>
                <button
                  onClick={() => { setVista('mese'); vaiOggi(); }}
                  className="flex items-center gap-1.5 text-sm font-medium text-bordeaux-700 hover:underline"
                >
                  Vedi il mese
                  <Icon nome="freccia" className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {inScadenza.map((e) => {
                  const giorni = Math.round((new Date(e.data).getTime() - new Date(todayIso).getTime()) / 86400000);
                  return (
                    <button
                      key={e.id}
                      onClick={() => setDetail(e)}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition-colors hover:border-bordeaux-300"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colore(e.tipo).tessera}`}>
                        <Icon nome="calendario" className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">{e.titolo}</span>
                        <span className="block text-xs text-neutral-500">
                          {labelFromOptions(TIPI_EVENTO, e.tipo)}
                        </span>
                      </span>
                      <span className={`shrink-0 text-xs font-semibold ${giorni === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {giorni === 0 ? 'Scade oggi' : giorni === 1 ? 'Scade domani' : `Tra ${giorni} giorni`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">{MESI[miniMese - 1]} {miniAnno}</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => cambiaMiniMese(-1)} aria-label="Mese precedente"
                  className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <Icon nome="freccia" className="h-4 w-4 rotate-180" />
                </button>
                <button
                  onClick={() => cambiaMiniMese(1)} aria-label="Mese successivo"
                  className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <Icon nome="freccia" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {GIORNI.map((g) => (
                <div key={g} className="py-1 text-[10px] font-semibold uppercase text-neutral-400">{g.slice(0, 1)}</div>
              ))}
              {miniCelle.map((d, i) => {
                if (!d) return <div key={`v${i}`} />;
                const iso = toIso(d);
                const haEventi = prossimi.some((e) => e.data === iso);
                const eOggi = iso === todayIso;
                const eSelezionato = iso === toIso(cursore);
                return (
                  <button
                    key={iso}
                    onClick={() => vaiAlGiorno(iso)}
                    className={`relative rounded-md py-1.5 text-xs transition-colors ${
                      eOggi ? 'bg-bordeaux-700 font-semibold text-white'
                        : eSelezionato ? 'bg-bordeaux-50 font-semibold text-bordeaux-700'
                          : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {d.getDate()}
                    {haEventi && !eOggi && (
                      <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-bordeaux-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Prossimi eventi</h3>
              <button
                onClick={() => { setVista('mese'); vaiOggi(); }}
                className="text-xs font-medium text-bordeaux-700 hover:underline"
              >
                Vedi tutto
              </button>
            </div>
            {prossimi.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">
                Nessun evento nei prossimi 30 giorni.
              </p>
            ) : (
              <ul className="space-y-1">
                {prossimi.map((e) => {
                  const col = colore(e.tipo);
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => setDetail(e)}
                        className="flex w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-neutral-50"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${col.tessera}`}>
                          <Icon nome="calendario" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs text-neutral-500">
                            {quandoLabel(e.data, todayIso)}
                            {!e.all_day && e.ora_inizio && ` · ${e.ora_inizio.slice(0, 5)}`}
                          </span>
                          <span className={`block text-xs font-semibold ${col.testo}`}>
                            {labelFromOptions(TIPI_EVENTO, e.tipo)}
                          </span>
                          <span className="block truncate text-sm text-neutral-800">{e.titolo}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {formDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-4">
          <div className="my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">Nuovo evento</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Data</label>
                {/* La data era nascosta: se hai aperto il giorno sbagliato te ne
                    accorgevi solo dopo aver salvato. Ora si vede e si corregge. */}
                <input
                  type="date" name="data" required defaultValue={formDate}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Titolo</label>
                <input name="titolo" required className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Tipo</label>
                <select name="tipo" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
                  {TIPI_EVENTO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Pratica collegata (facoltativa)</label>
                <select name="matter_id" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white">
                  <option value="">Nessuna</option>
                  {matters.map((m) => <option key={m.id} value={m.id}>{clientLabel(m.clients)} - {m.tipo_pratica}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Ora inizio</label>
                  <input type="time" name="ora_inizio" step={1800} defaultValue={formTime} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Ora fine</label>
                  <input type="time" name="ora_fine" step={1800} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Luogo</label>
                <input name="luogo" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Note</label>
                <textarea name="note" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-bordeaux-400 focus:bg-white" />
              </div>
              <div className="mt-2 flex justify-end gap-2 border-t border-neutral-200 pt-4">
                <button type="button" onClick={() => { setFormDate(null); setFormTime(''); }} className="premi rounded-full bg-neutral-100 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-200">Annulla</button>
                <button type="submit" className="premi rounded-full bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bordeaux-800">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colore(detail.tipo).tessera}`}>
                <Icon nome="calendario" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-neutral-900">{detail.titolo}</h2>
                <p className={`text-xs font-semibold ${colore(detail.tipo).testo}`}>
                  {labelFromOptions(TIPI_EVENTO, detail.tipo)}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-neutral-400">Data</dt>
              <dd className="text-neutral-800">
                {new Date(detail.data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </dd>
              <dt className="text-neutral-400">Ora</dt>
              <dd className="text-neutral-800">
                {detail.all_day ? 'Tutto il giorno' : `${detail.ora_inizio?.slice(0, 5) || ''}${detail.ora_fine ? ` – ${detail.ora_fine.slice(0, 5)}` : ''}`}
              </dd>
              <dt className="text-neutral-400">Luogo</dt>
              <dd className="text-neutral-800">{detail.luogo || '—'}</dd>
              <dt className="text-neutral-400">Note</dt>
              <dd className="whitespace-pre-wrap text-neutral-800">{detail.note || '—'}</dd>
            </dl>
            <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-neutral-200 pt-4">
              {detail.matter_id ? (
                <Link
                  href={`/pratiche/${detail.matter_id}`}
                  className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 hover:text-bordeaux-700"
                >
                  Apri la pratica
                </Link>
              ) : <span />}
              <span className="flex gap-2">
                <button onClick={() => handleDelete(detail.id)} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">Elimina</button>
                <button onClick={() => setDetail(null)} className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-200">Chiudi</button>
              </span>
            </div>
          </div>
        </div>
      )}

      {appointmentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">Prenotazione online</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-neutral-400">Cliente</dt>
              <dd className="text-neutral-800">{appointmentDetail.nome_cliente || '—'}</dd>
              <dt className="text-neutral-400">Data</dt>
              <dd className="text-neutral-800">
                {new Date(appointmentDetail.data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </dd>
              <dt className="text-neutral-400">Ora</dt>
              <dd className="text-neutral-800">{appointmentDetail.ora_inizio.slice(0, 5)} – {appointmentDetail.ora_fine.slice(0, 5)}</dd>
              <dt className="text-neutral-400">Stato</dt>
              <dd className="text-neutral-800">{appointmentDetail.stato === 'in_attesa' ? 'In attesa di conferma' : 'Confermato'}</dd>
            </dl>
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
              {appointmentDetail.stato === 'in_attesa' ? (
                <>
                  <button onClick={() => handleUpdateAppointment(appointmentDetail.id, 'rifiutato')} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">Rifiuta</button>
                  <button onClick={() => handleUpdateAppointment(appointmentDetail.id, 'confermato')} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Accetta</button>
                </>
              ) : (
                <button onClick={() => handleUpdateAppointment(appointmentDetail.id, 'cancellato')} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">Annulla appuntamento</button>
              )}
              <button onClick={() => setAppointmentDetail(null)} className="premi rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-200">Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

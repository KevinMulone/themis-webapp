/**
 * Genera un calendario in formato iCalendar (RFC 5545), quello che Google
 * Calendar, Apple Calendario e Outlook sanno leggere da un indirizzo.
 *
 * Le regole del formato sono più rigide di quanto sembri, e sbagliarne una
 * non dà un errore: dà un calendario che semplicemente non compare. Le tre
 * che contano davvero sono qui sotto — terminatori di riga CRLF, righe
 * ripiegate a 75 ottetti, e i caratteri speciali con la barra rovesciata.
 */

type EventoIcs = {
  id: string;
  titolo: string;
  tipo: string;
  data: string;                 // YYYY-MM-DD
  ora_inizio: string | null;    // HH:MM[:SS]
  ora_fine: string | null;
  all_day: boolean;
  luogo: string | null;
  note: string | null;
  updated_at?: string | null;
};

/** Nel testo di un campo, questi quattro caratteri hanno significato proprio. */
function testo(valore: string): string {
  return valore
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Nessuna riga può superare i 75 ottetti: le successive proseguono
 * indentate di uno spazio. Si conta in byte UTF-8, non in caratteri, o una
 * riga piena di accenti sfora senza che si veda.
 */
function ripiega(riga: string): string {
  const byte = Buffer.from(riga, 'utf-8');
  if (byte.length <= 75) return riga;

  const pezzi: string[] = [];
  let corrente = Buffer.alloc(0);
  for (const carattere of riga) {
    const c = Buffer.from(carattere, 'utf-8');
    // 74 per la prima riga, 73 per le successive: lo spazio iniziale conta.
    const limite = pezzi.length === 0 ? 75 : 74;
    if (corrente.length + c.length > limite) {
      pezzi.push(corrente.toString('utf-8'));
      corrente = Buffer.alloc(0);
    }
    corrente = Buffer.concat([corrente, c]);
  }
  if (corrente.length) pezzi.push(corrente.toString('utf-8'));
  return pezzi.join('\r\n ');
}

function soloCifre(valore: string): string {
  return valore.replace(/[^0-9]/g, '');
}

/** 2026-10-15 -> 20261015 */
function dataIcs(data: string): string {
  return soloCifre(data).slice(0, 8);
}

/** 2026-10-15 + 10:00 -> 20261015T100000 */
function dataOraIcs(data: string, ora: string): string {
  const o = soloCifre(ora).padEnd(6, '0').slice(0, 6);
  return `${dataIcs(data)}T${o}`;
}

/** Il giorno dopo, per DTEND degli eventi di giornata intera: in iCalendar la fine è esclusiva. */
function giornoSuccessivo(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function adesso(): string {
  return `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/**
 * Il fuso di Roma, scritto per esteso.
 *
 * Si potrebbe convertire tutto in UTC ed evitarlo, ma allora un'udienza
 * spostata a cavallo del cambio dell'ora finirebbe nell'ora sbagliata. Le
 * regole qui sono quelle europee: ultima domenica di marzo e di ottobre.
 */
const FUSO_ROMA = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Rome',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export function calendarioIcs(
  eventi: EventoIcs[],
  { nomeCalendario, etichettaTipo }: { nomeCalendario: string; etichettaTipo: (tipo: string) => string },
): string {
  const righe: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Themis//Calendario dello studio//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${testo(nomeCalendario)}`,
    'X-WR-TIMEZONE:Europe/Rome',
    // Ogni quanto il lettore dovrebbe ricontrollare. È un suggerimento:
    // Google lo prende come tale e aggiorna quando decide lui.
    'REFRESH-INTERVAL;VALUE=DURATION:PT2H',
    'X-PUBLISHED-TTL:PT2H',
    ...FUSO_ROMA,
  ];

  const timbro = adesso();

  for (const ev of eventi) {
    const tipo = etichettaTipo(ev.tipo);
    // Il tipo davanti al titolo: in mezzo agli impegni personali di chi
    // guarda il telefono, "Udienza — Rossi" si riconosce, "Rossi" no.
    const sommario = tipo && !ev.titolo.toLowerCase().startsWith(tipo.toLowerCase())
      ? `${tipo} — ${ev.titolo}`
      : ev.titolo;

    const descrizione = [ev.note, ev.luogo ? `Luogo: ${ev.luogo}` : null]
      .filter(Boolean).join('\n\n');

    righe.push('BEGIN:VEVENT');
    righe.push(`UID:${ev.id}@themis`);
    righe.push(`DTSTAMP:${timbro}`);

    if (ev.all_day || !ev.ora_inizio) {
      righe.push(`DTSTART;VALUE=DATE:${dataIcs(ev.data)}`);
      righe.push(`DTEND;VALUE=DATE:${dataIcs(giornoSuccessivo(ev.data))}`);
    } else {
      righe.push(`DTSTART;TZID=Europe/Rome:${dataOraIcs(ev.data, ev.ora_inizio)}`);
      // Senza ora di fine si dà un'ora: un evento a durata zero, in certi
      // lettori, non si vede proprio.
      const fine = ev.ora_fine
        ? dataOraIcs(ev.data, ev.ora_fine)
        : dataOraIcs(ev.data, `${String(Number(ev.ora_inizio.slice(0, 2)) + 1).padStart(2, '0')}${ev.ora_inizio.slice(2, 5)}`);
      righe.push(`DTEND;TZID=Europe/Rome:${fine}`);
    }

    righe.push(`SUMMARY:${testo(sommario)}`);
    if (ev.luogo) righe.push(`LOCATION:${testo(ev.luogo)}`);
    if (descrizione) righe.push(`DESCRIPTION:${testo(descrizione)}`);
    righe.push('END:VEVENT');
  }

  righe.push('END:VCALENDAR');
  return righe.map(ripiega).join('\r\n') + '\r\n';
}

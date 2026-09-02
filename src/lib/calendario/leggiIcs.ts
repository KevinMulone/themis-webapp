/**
 * Legge un file iCalendar (RFC 5545) e ne ricava gli impegni.
 *
 * Serve alla migrazione di chi arriva da Google Calendar: Google esporta
 * l'intero calendario in questo formato, e importarlo non richiede né
 * OAuth né alcun permesso — è un file che l'avvocato scarica dal proprio
 * account e consegna a Themis.
 *
 * Il formato ha tre trappole che qui vengono affrontate nell'ordine
 * giusto: le righe lunghe sono spezzate e vanno ricucite PRIMA di
 * qualunque altra analisi, i caratteri speciali viaggiano con la barra
 * rovesciata, e gli orari possono arrivare in tre forme diverse (data
 * secca, ora locale con fuso dichiarato, ora UTC) che vanno riportate
 * tutte all'ora italiana, perché è quella che Themis conserva.
 */

export type ImpegnoImportato = {
  uid: string;
  titolo: string;
  data: string;              // YYYY-MM-DD
  ora_inizio: string | null; // HH:MM
  ora_fine: string | null;
  all_day: boolean;
  luogo: string | null;
  note: string | null;
  ricorrente: boolean;
};

/** Ricuce le righe spezzate: una riga che inizia con spazio o tabulazione
 *  è la continuazione della precedente. Va fatto per primo. */
function ricuci(testo: string): string[] {
  const righe = testo.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const intere: string[] = [];
  for (const riga of righe) {
    if ((riga.startsWith(' ') || riga.startsWith('\t')) && intere.length > 0) {
      intere[intere.length - 1] += riga.slice(1);
    } else {
      intere.push(riga);
    }
  }
  return intere;
}

/** L'inverso dell'escape: \\n torna a capo, \, e \; tornano se stessi. */
function testoLibero(valore: string): string {
  return valore
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/** Da un istante UTC all'ora di Roma, senza librerie: il fuso lo conosce
 *  già il motore JavaScript, va solo interrogato nel modo giusto. */
function aOraDiRoma(istante: Date): { data: string; ora: string } {
  const parti = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(istante); // "2026-10-15 10:00"
  const [data, ora] = parti.split(' ');
  return { data, ora };
}

type ValoreData = { data: string; ora: string | null; all_day: boolean };

/**
 * Interpreta un DTSTART/DTEND nelle sue tre forme:
 *   VALUE=DATE:20261015          -> giornata intera
 *   TZID=Europe/Rome:...T100000  -> ora già locale
 *   20261015T080000Z             -> UTC, da riportare all'ora italiana
 */
function leggiData(parametri: string, valore: string): ValoreData | null {
  const grezzo = valore.trim();
  const soloData = /^(\d{4})(\d{2})(\d{2})$/.exec(grezzo);
  if (soloData || /VALUE=DATE(?!-TIME)/i.test(parametri)) {
    const m = soloData ?? /^(\d{4})(\d{2})(\d{2})/.exec(grezzo);
    if (!m) return null;
    return { data: `${m[1]}-${m[2]}-${m[3]}`, ora: null, all_day: true };
  }

  const conOra = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(grezzo);
  if (!conOra) return null;
  const [, anno, mese, giorno, ore, minuti, , zulu] = conOra;

  if (zulu) {
    const istante = new Date(Date.UTC(+anno, +mese - 1, +giorno, +ore, +minuti));
    const { data, ora } = aOraDiRoma(istante);
    return { data, ora, all_day: false };
  }

  // Ora locale (con TZID dichiarato o "fluttuante"): si prende com'è. Per
  // un calendario italiano è l'ora giusta; convertirla senza sapere il
  // fuso di partenza farebbe più danni che altro.
  return { data: `${anno}-${mese}-${giorno}`, ora: `${ore}:${minuti}`, all_day: false };
}

/** In iCalendar la fine di un evento di giornata intera è esclusiva:
 *  un evento di un giorno finisce il giorno dopo. */
function giornoPrecedente(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function leggiIcs(contenuto: string): ImpegnoImportato[] {
  const righe = ricuci(contenuto);
  const impegni: ImpegnoImportato[] = [];

  let dentro = false;
  let corrente: Record<string, { parametri: string; valore: string }> = {};

  for (const riga of righe) {
    const testo = riga.trim();
    if (testo === 'BEGIN:VEVENT') { dentro = true; corrente = {}; continue; }

    if (testo === 'END:VEVENT') {
      dentro = false;
      const stato = corrente['STATUS']?.valore?.toUpperCase();
      const inizio = corrente['DTSTART'] ? leggiData(corrente['DTSTART'].parametri, corrente['DTSTART'].valore) : null;

      // Senza inizio non è un impegno; gli eventi annullati non si importano.
      if (!inizio || stato === 'CANCELLED') continue;

      const fine = corrente['DTEND'] ? leggiData(corrente['DTEND'].parametri, corrente['DTEND'].valore) : null;
      const titolo = corrente['SUMMARY'] ? testoLibero(corrente['SUMMARY'].valore) : '';

      impegni.push({
        uid: corrente['UID']?.valore?.trim() || `${inizio.data}-${titolo}`,
        titolo: titolo || '(senza titolo)',
        data: inizio.data,
        ora_inizio: inizio.all_day ? null : inizio.ora,
        // La fine si tiene solo se cade nello stesso giorno: Themis non
        // rappresenta un impegno a cavallo di più giornate.
        ora_fine: !inizio.all_day && fine && !fine.all_day && fine.data === inizio.data ? fine.ora : null,
        all_day: inizio.all_day,
        luogo: corrente['LOCATION'] ? testoLibero(corrente['LOCATION'].valore) || null : null,
        note: corrente['DESCRIPTION'] ? testoLibero(corrente['DESCRIPTION'].valore) || null : null,
        ricorrente: !!corrente['RRULE'],
      });
      continue;
    }

    if (!dentro) continue;

    const duePunti = testo.indexOf(':');
    if (duePunti === -1) continue;
    const sinistra = testo.slice(0, duePunti);
    const valore = testo.slice(duePunti + 1);
    const puntoEVirgola = sinistra.indexOf(';');
    const nome = (puntoEVirgola === -1 ? sinistra : sinistra.slice(0, puntoEVirgola)).toUpperCase();
    const parametri = puntoEVirgola === -1 ? '' : sinistra.slice(puntoEVirgola + 1);

    // Di un campo ripetuto si tiene il primo: nei file di Google capita
    // per le traduzioni alternative dello stesso valore.
    if (!corrente[nome]) corrente[nome] = { parametri, valore };
  }

  // Gli eventi di giornata intera esportati con fine esclusiva su più
  // giorni restano comunque ancorati al giorno d'inizio: è il dato che
  // serve, e non si inventa una durata che Themis non saprebbe mostrare.
  return impegni;
}

export { giornoPrecedente };

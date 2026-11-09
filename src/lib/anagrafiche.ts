export type AnagraficaEssenziale = {
  id?: string;
  tipo_soggetto?: string | null;
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  email?: string | null;
  pec?: string | null;
  telefono?: string | null;
};

/**
 * Identificativo di un cittadino straniero senza codice fiscale italiano: tax ID, numero di
 * passaporto o di un altro documento. Non ha una cifra di controllo comune, quindi si verifica
 * solo che abbia un aspetto plausibile (3-30 tra lettere, cifre, spazi, punti, trattini, barre).
 */
export function codiceEsteroValido(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 ./-]{2,29}$/.test(String(value ?? '').trim());
}

export type ErroreAnagrafica = { campo: string; messaggio: string };

export function normalizzaCodice(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

export function emailValida(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/** La lettera di controllo che il codice fiscale dovrebbe avere, calcolata sui primi 15 caratteri. */
export function carattereControllo(primi15: string): string {
  // Posizioni pari: cifre 0-9 valgono 0-9, lettere A-Z valgono 0-25.
  const valorePari = (c: string) => (c >= '0' && c <= '9' ? Number(c) : c.charCodeAt(0) - 65);
  let somma = 0;
  for (let i = 0; i < 15; i += 1) {
    somma += i % 2 === 0 ? DISPARI[primi15[i]] : valorePari(primi15[i]);
  }
  return String.fromCharCode(65 + (somma % 26));
}

/**
 * Codice fiscale di una persona (16 caratteri) o di un ente, un condominio, una società
 * (11 cifre, con la stessa cifra di controllo della partita IVA).
 */
export function codiceFiscaleValido(value: string): boolean {
  const cf = normalizzaCodice(value);
  if (/^\d{11}$/.test(cf)) return partitaIvaValida(cf);
  if (!/^[A-Z0-9]{16}$/.test(cf)) return false;
  return cf[15] === carattereControllo(cf.slice(0, 15));
}

// Dove il codice fiscale ha una lettera (cognome, nome, mese, comune, controllo) e dove una cifra.
const POSIZIONI_LETTERA = new Set([0, 1, 2, 3, 4, 5, 8, 11, 15]);

/**
 * Normalizza il codice fiscale e, se è sbagliato solo per lo scambio tra O e 0 o tra I e 1
 * (l'errore più comune quando lo si copia), lo corregge. Corregge solo se il risultato è un
 * codice valido: non indovina mai altri errori.
 */
export function normalizzaCodiceFiscale(value: unknown): string {
  const cf = normalizzaCodice(value);
  if (cf.length !== 16 || codiceFiscaleValido(cf)) return cf;
  const corretto = cf.split('').map((c, i) => {
    if (POSIZIONI_LETTERA.has(i)) return c === '0' ? 'O' : c === '1' ? 'I' : c;
    return c === 'O' ? '0' : c === 'I' ? '1' : c;
  }).join('');
  return codiceFiscaleValido(corretto) ? corretto : cf;
}

/** Il messaggio per un codice fiscale che non passa il controllo, con la lettera attesa quando si può dire. */
export function erroreCodiceFiscale(value: string): string {
  const cf = normalizzaCodice(value);
  if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf)) {
    return `Il codice fiscale non supera il controllo: l'ultima lettera dovrebbe essere ${carattereControllo(cf.slice(0, 15))}. `
      + 'Controllalo sulla tessera sanitaria (le altre lettere e cifre potrebbero essere sbagliate).';
  }
  if (cf.length === 16) {
    return 'Il codice fiscale non supera il controllo: controlla che O/0 e I/1 siano al posto giusto (le cifre sono 0 e 1, le lettere O e I).';
  }
  return 'Il codice fiscale non supera il controllo: deve avere 16 caratteri (persona) o 11 cifre (ente, condominio, società).';
}

export function partitaIvaValida(value: string): boolean {
  const piva = normalizzaCodice(value);
  if (!/^\d{11}$/.test(piva)) return false;
  let somma = 0;
  for (let i = 0; i < 10; i += 1) {
    let cifra = Number(piva[i]);
    if (i % 2 === 1) {
      cifra *= 2;
      if (cifra > 9) cifra -= 9;
    }
    somma += cifra;
  }
  return (10 - (somma % 10)) % 10 === Number(piva[10]);
}

export function validaAnagrafica(data: AnagraficaEssenziale, opzioni: { codiceEstero?: boolean } = {}): ErroreAnagrafica[] {
  const controllaCodice = (codice: string): ErroreAnagrafica | null => {
    if (opzioni.codiceEstero) {
      return codiceEsteroValido(codice) ? null
        : { campo: 'codice_fiscale', messaggio: 'Il codice o il numero di documento estero deve avere da 3 a 30 caratteri (lettere, cifre, spazi, punti, trattini).' };
    }
    return codiceFiscaleValido(codice) ? null : { campo: 'codice_fiscale', messaggio: erroreCodiceFiscale(codice) };
  };
  const errori: ErroreAnagrafica[] = [];
  const personaFisica = (data.tipo_soggetto || 'persona_fisica') === 'persona_fisica';
  if (personaFisica) {
    if (!String(data.nome ?? '').trim()) errori.push({ campo: 'nome', messaggio: 'Inserisci il nome.' });
    if (!String(data.cognome ?? '').trim()) errori.push({ campo: 'cognome', messaggio: 'Inserisci il cognome.' });
    const erroreCf = data.codice_fiscale ? controllaCodice(data.codice_fiscale) : null;
    if (erroreCf) errori.push(erroreCf);
  } else {
    if (!String(data.ragione_sociale ?? '').trim()) errori.push({ campo: 'ragione_sociale', messaggio: 'Inserisci la ragione sociale.' });
    if (data.partita_iva && !partitaIvaValida(data.partita_iva)) {
      errori.push({ campo: 'partita_iva', messaggio: 'La partita IVA non supera il controllo formale.' });
    }
    // un condominio o un ente può avere solo il codice fiscale
    const erroreCf = data.codice_fiscale ? controllaCodice(data.codice_fiscale) : null;
    if (erroreCf) errori.push(erroreCf);
  }
  if (data.email && !emailValida(data.email)) errori.push({ campo: 'email', messaggio: 'Indirizzo email non valido.' });
  if (data.pec && !emailValida(data.pec)) errori.push({ campo: 'pec', messaggio: 'Indirizzo PEC non valido.' });
  if (data.telefono && !/^[+\d][\d\s()./-]{5,24}$/.test(data.telefono.trim())) {
    errori.push({ campo: 'telefono', messaggio: 'Numero di telefono non valido.' });
  }
  return errori;
}

export function trovaPossibiliDuplicati(
  corrente: AnagraficaEssenziale,
  esistenti: AnagraficaEssenziale[],
): AnagraficaEssenziale[] {
  const cf = normalizzaCodice(corrente.codice_fiscale);
  const piva = normalizzaCodice(corrente.partita_iva);
  const pec = String(corrente.pec ?? '').trim().toLowerCase();
  const email = String(corrente.email ?? '').trim().toLowerCase();
  const nome = [corrente.nome, corrente.cognome, corrente.ragione_sociale]
    .filter(Boolean).join(' ').trim().toLocaleLowerCase('it');
  return esistenti.filter((item) => {
    if (corrente.id && item.id === corrente.id) return false;
    if (cf && cf === normalizzaCodice(item.codice_fiscale)) return true;
    if (piva && piva === normalizzaCodice(item.partita_iva)) return true;
    if (pec && pec === String(item.pec ?? '').trim().toLowerCase()) return true;
    if (email && email === String(item.email ?? '').trim().toLowerCase()) return true;
    const altroNome = [item.nome, item.cognome, item.ragione_sociale]
      .filter(Boolean).join(' ').trim().toLocaleLowerCase('it');
    return nome.length >= 5 && nome === altroNome;
  });
}

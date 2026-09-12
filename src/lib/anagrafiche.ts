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

export type ErroreAnagrafica = { campo: string; messaggio: string };

export function normalizzaCodice(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

export function emailValida(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

export function codiceFiscaleValido(value: string): boolean {
  const cf = normalizzaCodice(value);
  if (!/^[A-Z0-9]{16}$/.test(cf)) return false;
  const dispari: Record<string, number> = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
    K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
    U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
  };
  const pari = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let somma = 0;
  for (let i = 0; i < 15; i += 1) {
    somma += i % 2 === 0 ? dispari[cf[i]] : pari.indexOf(cf[i]);
  }
  return cf[15] === String.fromCharCode(65 + (somma % 26));
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

export function validaAnagrafica(data: AnagraficaEssenziale): ErroreAnagrafica[] {
  const errori: ErroreAnagrafica[] = [];
  const personaFisica = (data.tipo_soggetto || 'persona_fisica') === 'persona_fisica';
  if (personaFisica) {
    if (!String(data.nome ?? '').trim()) errori.push({ campo: 'nome', messaggio: 'Inserisci il nome.' });
    if (!String(data.cognome ?? '').trim()) errori.push({ campo: 'cognome', messaggio: 'Inserisci il cognome.' });
    if (data.codice_fiscale && !codiceFiscaleValido(data.codice_fiscale)) {
      errori.push({ campo: 'codice_fiscale', messaggio: 'Il codice fiscale non supera il controllo formale.' });
    }
  } else {
    if (!String(data.ragione_sociale ?? '').trim()) errori.push({ campo: 'ragione_sociale', messaggio: 'Inserisci la ragione sociale.' });
    if (data.partita_iva && !partitaIvaValida(data.partita_iva)) {
      errori.push({ campo: 'partita_iva', messaggio: 'La partita IVA non supera il controllo formale.' });
    }
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

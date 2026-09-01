/**
 * Memoria dei valori già digitati, per campo.
 *
 * Sta nel browser e non nel database, ed è una scelta: sono preferenze di
 * digitazione, non dati dello studio. Se un domani servisse condividerle
 * fra collaboratori, allora sì che andrebbero spostate — ma quel giorno
 * cambia il posto, non il comportamento.
 */

const PREFISSO = 'themis:usati:';
const MASSIMO = 12;

type Conteggio = Record<string, number>;

function leggiConteggio(chiave: string): Conteggio {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PREFISSO + chiave) || '{}') as Conteggio;
  } catch {
    // Un valore corrotto non deve rompere un modulo: si riparte da zero.
    return {};
  }
}

/** I valori già usati per quel campo, dal più frequente al meno. */
export function valoriUsati(chiave: string): string[] {
  return Object.entries(leggiConteggio(chiave))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MASSIMO)
    .map(([valore]) => valore);
}

export function registraUso(chiave: string, valore: string): void {
  const pulito = valore.trim();
  if (!pulito || typeof window === 'undefined') return;
  const conteggio = leggiConteggio(chiave);
  conteggio[pulito] = (conteggio[pulito] || 0) + 1;
  try {
    localStorage.setItem(PREFISSO + chiave, JSON.stringify(conteggio));
  } catch {
    // Spazio esaurito o modalità privata: si perde il suggerimento, non il lavoro.
  }
}

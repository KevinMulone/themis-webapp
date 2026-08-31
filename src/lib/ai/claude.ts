import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Il modello, in un punto solo.
 *
 * Si è scelto il più capace: in materia legale la qualità del
 * ragionamento conta più del risparmio, e una risposta sbagliata su un
 * fascicolo costa molto più di qualche centesimo di API. Se col tempo i
 * costi reali non convincono, `claude-sonnet-5` costa circa la metà e si
 * cambia qui, in una riga.
 */
export const MODELLO = 'claude-opus-5';

/**
 * Prezzi in dollari per milione di token, da listino. Servono solo a
 * stimare il consumo per il tetto mensile: il conto vero lo fa Anthropic,
 * questi numeri vanno riallineati se il listino cambia.
 */
export const PREZZO_USD_PER_MILIONE = {
  input: 5,
  output: 25,
  /** La lettura dalla cache costa un decimo dell'ingresso normale. */
  cacheLettura: 0.5,
  /** Scrivere in cache costa un quarto in più della prima lettura. */
  cacheScrittura: 6.25,
};

/** Conversione approssimata: il tetto è una stima, non una fattura. */
export const CAMBIO_USD_EUR = 0.92;

export function getClaude(): Anthropic {
  // Legge ANTHROPIC_API_KEY dall'ambiente.
  return new Anthropic();
}

/** True se la funzione è configurata: senza chiave le route rispondono
 *  con un messaggio comprensibile invece di un errore di rete. */
export function aiConfigurata(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

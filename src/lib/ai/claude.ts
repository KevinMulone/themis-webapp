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

// Nota: qui si ragiona in DOLLARI, non in euro, ed è voluto. Anthropic
// fattura in dollari e il credito si ricarica in dollari: convertire in
// euro con un cambio scritto nel codice significherebbe mostrare un
// consumo che non corrisponde mai a quello della console. Una sola
// unità, quella in cui si paga davvero.

export function getClaude(): Anthropic {
  // Legge ANTHROPIC_API_KEY dall'ambiente.
  return new Anthropic();
}

/** True se la funzione è configurata: senza chiave le route rispondono
 *  con un messaggio comprensibile invece di un errore di rete. */
export function aiConfigurata(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Ritenta quando il servizio è momentaneamente sovraccarico.
 *
 * Il 529 non significa "richiesta sbagliata": significa "riprova fra
 * poco". Farlo fallire subito trasforma un intoppo di due secondi in un
 * lavoro perso, e per l'utente in un errore incomprensibile.
 *
 * L'attesa raddoppia a ogni tentativo perché ritentare subito, tutti
 * insieme, è il modo migliore per tenere sovraccarico un servizio che sta
 * cercando di riprendersi.
 */
export async function conRitentativi<T>(
  operazione: () => Promise<T>,
  tentativi = 3,
): Promise<T> {
  let attesa = 1500;
  for (let i = 1; ; i++) {
    try {
      return await operazione();
    } catch (errore) {
      const e = errore as { status?: number };
      const ritentabile = e?.status === 429 || e?.status === 529 || e?.status === 500
        || e?.status === 502 || e?.status === 503;
      if (!ritentabile || i >= tentativi) throw errore;
      await new Promise((r) => setTimeout(r, attesa));
      attesa *= 2;
    }
  }
}

/** Il messaggio da mostrare a chi legge, al posto dell'errore tecnico. */
export function messaggioErroreAi(errore: unknown): string {
  const e = errore as { status?: number; message?: string };
  if (e?.status === 529 || e?.status === 503) {
    return 'Themis è momentaneamente sovraccarico. Riprova fra un minuto.';
  }
  if (e?.status === 429) {
    return 'Troppe richieste ravvicinate. Aspetta qualche secondo e riprova.';
  }
  if (e?.status === 401 || e?.status === 403) {
    return 'Themis non è configurato correttamente su questo sito.';
  }
  return `Richiesta non riuscita: ${e?.message ?? 'errore imprevisto'}`;
}

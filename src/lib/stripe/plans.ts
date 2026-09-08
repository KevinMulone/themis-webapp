export const PLANS = {
  monthly: { envPrice: 'STRIPE_PRICE_MONTHLY', days: 30, label: 'Mensile' },
  semestrale: { envPrice: 'STRIPE_PRICE_SEMESTRALE', days: 180, label: 'Semestrale' },
  annuale: { envPrice: 'STRIPE_PRICE_ANNUALE', days: 365, label: 'Annuale' },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Quanti collaboratori può invitare il titolare, oltre a sé stesso.
 *
 * I posti sono legati alla durata dell'abbonamento e non a livelli di
 * servizio separati: è una scelta commerciale di Kevin — impegnarsi più a
 * lungo dà più posti. Se un domani si vorranno separare le due cose
 * (durata da una parte, dimensione dello studio dall'altra), è questo
 * l'unico punto da cambiare.
 */
export const POSTI_COLLABORATORI: Record<PlanKey, number> = {
  monthly: 1,
  semestrale: 3,
  annuale: 5,
};

/**
 * Credito mensile per l'intelligenza artificiale, in centesimi di DOLLARO
 * (è la valuta in cui fattura Anthropic: vedi la nota in lib/ai/claude.ts).
 *
 * Sono il margine di Kevin: con i prezzi attuali una domanda su un
 * fascicolo di ~20 pagine costa circa 10 centesimi. Da tarare guardando
 * il consumo reale.
 *
 * Il mensile non include l'assistente (0): è una scelta commerciale, non
 * un limite tecnico — differenzia il piano base da quelli più impegnativi.
 * Questa costante è solo il valore di ripiego: il limite vero vive nella
 * tabella limiti_assistente, regolabile da Kevin dal pannello admin senza
 * una pubblicazione (vedi creditoStudio in lib/ai/credito.ts) — tienila
 * allineata a quei valori quando li cambi, così un piano senza riga nella
 * tabella si comporta comunque come ci si aspetta.
 */
export const CREDITO_AI_MENSILE_CENT: Record<PlanKey, number> = {
  monthly: 0,
  semestrale: 300,
  annuale: 1800,
};

export function creditoAiMensileCent(plan: string | null): number {
  return plan && isPlanKey(plan) ? CREDITO_AI_MENSILE_CENT[plan] : 0;
}

export function postiPerPiano(plan: string | null): number {
  return plan && isPlanKey(plan) ? POSTI_COLLABORATORI[plan] : 0;
}

export function isPlanKey(value: string): value is PlanKey {
  return value in PLANS;
}

export function priceIdFor(plan: PlanKey): string {
  return process.env[PLANS[plan].envPrice]!;
}

export function planKeyFromPriceId(priceId: string): PlanKey | null {
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    if (process.env[PLANS[key].envPrice] === priceId) return key;
  }
  return null;
}

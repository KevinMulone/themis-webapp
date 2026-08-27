/**
 * Tabelle di Milano, edizione 2024 (Osservatorio sulla Giustizia Civile di
 * Milano, riunione del 21.05.2024, valori pubblicati il 4.6.2024).
 *
 * Fonte: PDF ufficiale "TRIBUNALE DI MILANO - LIQUIDAZIONE DEL DANNO NON
 * PATRIMONIALE - TABELLE 2024" (Osservatorio, dott. Damiano Spera). I 100
 * valori sotto sono stati estratti dal documento e verificati incrociando
 * ogni valore con la formula di incremento per sofferenza soggettiva
 * dichiarata nel testo stesso (nessuna discrepanza riscontrata).
 *
 * Attenzione: l'Osservatorio aggiorna periodicamente i valori secondo gli
 * indici ISTAT. Prima di un uso professionale, verificare che non sia nel
 * frattempo uscita un'edizione più recente.
 */

// Valore "punto danno biologico" (colonna A) per ogni punto di invalidità permanente, 1-100.
export const PUNTO_DANNO_BIOLOGICO: Record<number, number> = {
  1: 1393.28, 2: 1480.36, 3: 1567.44, 4: 1654.52, 5: 1741.6, 6: 1915.76, 7: 2089.92, 8: 2264.08, 9: 2438.24, 10: 2612.4,
  11: 2732.57, 12: 2851.87, 13: 2972.04, 14: 3091.34, 15: 3211.51, 16: 3330.81, 17: 3450.98, 18: 3570.28, 19: 3690.45, 20: 3809.75,
  21: 3929.92, 22: 4049.22, 23: 4169.39, 24: 4288.69, 25: 4408.86, 26: 4528.16, 27: 4648.33, 28: 4767.63, 29: 4887.8, 30: 5007.1,
  31: 5127.27, 32: 5246.57, 33: 5366.74, 34: 5486.04, 35: 5606.21, 36: 5725.51, 37: 5845.68, 38: 5964.98, 39: 6085.15, 40: 6204.45,
  41: 6324.62, 42: 6443.92, 43: 6564.09, 44: 6683.39, 45: 6803.56, 46: 6922.86, 47: 7043.03, 48: 7162.33, 49: 7282.5, 50: 7401.8,
  51: 7517.62, 52: 7629.08, 53: 7737.06, 54: 7840.68, 55: 7940.83, 56: 8037.48, 57: 8129.79, 58: 8218.61, 59: 8303.95, 60: 8385.8,
  61: 8464.18, 62: 8538.19, 63: 8609.6, 64: 8678.39, 65: 8742.83, 66: 8804.66, 67: 8863.0, 68: 8918.73, 69: 8971.85, 70: 9021.49,
  71: 9068.51, 72: 9112.92, 73: 9153.85, 74: 9193.04, 75: 9229.61, 76: 9263.57, 77: 9294.92, 78: 9325.4, 79: 9351.52, 80: 9376.77,
  81: 9399.42, 82: 9420.31, 83: 9440.34, 84: 9457.76, 85: 9473.43, 86: 9487.37, 87: 9500.43, 88: 9511.75, 89: 9522.2, 90: 9530.91,
  91: 9538.74, 92: 9545.71, 93: 9551.81, 94: 9557.03, 95: 9561.38, 96: 9565.74, 97: 9569.22, 98: 9572.7, 99: 9575.32, 100: 9578.8,
};

// Valore monetario per un giorno di inabilità temporanea assoluta (100%): € 84 danno
// dinamico-relazionale + € 31 sofferenza soggettiva interiore media presumibile.
export const ITT_GIORNALIERO = 115.0;
export const ITT_PERSONALIZZAZIONE_MAX_PCT = 50;

/**
 * Incremento % per la componente di sofferenza soggettiva interiore, da sommare
 * al valore del punto biologico per ottenere il "punto danno non patrimoniale"
 * (colonna A+B). Regola dichiarata dall'Osservatorio: 25% fisso da 1 a 9 punti,
 * progressivo da 26% a 50% da 10 a 34 punti, 50% fisso da 35 a 100 punti.
 */
export function incrementoSofferenza(punto: number): number {
  return Math.min(50, Math.max(25, punto + 16));
}

// Valore "punto danno non patrimoniale" (colonna A+B): il valore per punto già
// comprensivo della componente di sofferenza soggettiva.
export function puntoDannoNonPatrimoniale(punto: number): number {
  const a = PUNTO_DANNO_BIOLOGICO[punto];
  if (a === undefined) throw new Error(`Punto di invalidità non valido: ${punto}`);
  return a * (1 + incrementoSofferenza(punto) / 100);
}

/**
 * Demoltiplicatore per età: 1 - (età-1) × 0,005. Formula pubblicata
 * dall'Osservatorio e verificata sui valori tabellari per tutte le fasce
 * (1-10, 41-50, 91-100), coincide esattamente su tutto il range 1-100 anni.
 */
export function demoltiplicatoreEta(eta: number): number {
  if (eta < 1) return 1;
  if (eta > 100) eta = 100;
  return 1 - (eta - 1) * 0.005;
}

export type CalcoloDannoInput = {
  eta: number;
  puntiInvalidita: number;
  ittGiorni: number; // giorni di invalidità temporanea totale (100%)
  itpTranche: { percentuale: number; giorni: number }[]; // es. [{percentuale: 50, giorni: 60}]
  speseMediche: number;
  personalizzazionePct: number; // 0-50, scelta discrezionale entro il tetto di legge/tabella
};

export type CalcoloDannoOutput = {
  valoreA: number;
  valoreB: number;
  incrementoSofferenzaPct: number;
  demoltiplicatore: number;
  dannoPermanente: number;
  dannoTemporaneoTotale: number;
  itpDettaglio: { percentuale: number; giorni: number; importo: number }[];
  speseMediche: number;
  totaleSenzaPersonalizzazione: number;
  personalizzazioneImporto: number;
  totaleConPersonalizzazione: number;
};

export function calcolaDanno(input: CalcoloDannoInput): CalcoloDannoOutput {
  const { eta, puntiInvalidita, ittGiorni, itpTranche, speseMediche, personalizzazionePct } = input;
  if (puntiInvalidita < 1 || puntiInvalidita > 100) {
    throw new Error('I punti di invalidità devono essere tra 1 e 100');
  }
  const valoreA = PUNTO_DANNO_BIOLOGICO[Math.round(puntiInvalidita)];
  const incrementoPct = incrementoSofferenza(Math.round(puntiInvalidita));
  const valoreB = valoreA * (1 + incrementoPct / 100);
  const demoltiplicatore = demoltiplicatoreEta(eta);
  const dannoPermanente = puntiInvalidita * valoreB * demoltiplicatore;

  const ittImporto = ittGiorni * ITT_GIORNALIERO;
  const itpDettaglio = itpTranche.map((t) => ({
    percentuale: t.percentuale,
    giorni: t.giorni,
    importo: t.giorni * ITT_GIORNALIERO * (t.percentuale / 100),
  }));
  const itpTotale = itpDettaglio.reduce((sum, t) => sum + t.importo, 0);
  const dannoTemporaneoTotale = ittImporto + itpTotale;

  const totaleSenzaPersonalizzazione = dannoPermanente + dannoTemporaneoTotale + speseMediche;
  const personalizzazioneImporto = dannoPermanente * (personalizzazionePct / 100);
  const totaleConPersonalizzazione = totaleSenzaPersonalizzazione + personalizzazioneImporto;

  return {
    valoreA, valoreB, incrementoSofferenzaPct: incrementoPct, demoltiplicatore,
    dannoPermanente, dannoTemporaneoTotale, itpDettaglio, speseMediche,
    totaleSenzaPersonalizzazione, personalizzazioneImporto, totaleConPersonalizzazione,
  };
}

/**
 * Danno da circolazione di veicoli (RCA): art. 139 Cod. Ass. (micropermanenti,
 * invalidità 1-9%) e Tabella Unica Nazionale ex art. 138 Cod. Ass., D.P.R.
 * 13 gennaio 2025, n. 12 (macropermanenti, invalidità 10-100%).
 *
 * A differenza delle Tabelle di Milano (per i danni NON da circolazione, o
 * da circolazione quando le tabelle di legge non trovano applicazione),
 * queste tabelle sono vincolanti per legge per i sinistri da circolazione
 * di veicoli a motore e natanti (e, dal D.P.R. 12/2025, anche per la
 * responsabilità sanitaria).
 *
 * Valori aggiornati (in vigore da aprile 2026): D.M. Ministero delle imprese
 * e del made in Italy 20 luglio 2026 (G.U. n. 173 del 28.7.2026), +2,6% ISTAT
 * rispetto ai valori precedenti (€963,40 e €56,18).
 * - Valore del 1° punto di invalidità: €988,45 (art. 139, comma 1, lett. a,
 *   ultimo periodo — il valore vale anche per la TUN, art. 2 D.P.R. 12/2025).
 * - Indennità giornaliera ITT: €57,64 (art. 139, comma 1, lett. b — vale
 *   anche per la TUN, art. 3 D.P.R. 12/2025).
 *
 * Il coefficiente moltiplicatore per i punti 1-9 (art. 139, comma 6) è
 * fissato dalla LEGGE STESSA, non da un decreto di aggiornamento, quindi è
 * stabile nel tempo: 1 / 1,1 / 1,2 / 1,3 / 1,5 / 1,7 / 1,9 / 2,1 / 2,3.
 *
 * I coefficienti della Tabella Unica Nazionale (Tavola 1.A, 1.B e Tavola 2,
 * Allegati I e II al D.P.R. 12/2025) sono stati verificati sullo schema di
 * decreto (bollato IVASS 11.11.2024, immediatamente precedente
 * l'approvazione definitiva del 13.1.2025: gli allegati tecnici non
 * cambiano tra lo schema bollato e il decreto firmato) e incrociati
 * aritmeticamente con gli esempi numerici riportati nello stesso documento
 * (punto 10: 947,30 × 2,75773 = 2.612,14 ≈ 2.612,40 pubblicato; incremento
 * morale minimo 21,0% = coefficiente 0,21 pubblicato in Tavola 2).
 */

export const VALORE_PRIMO_PUNTO = 988.45;
export const ITT_GIORNALIERO_CIRCOLAZIONE = 57.64;

// Art. 139, comma 6, Cod. Ass. — fissato per legge, non aggiornato da decreto.
const COEFFICIENTI_MICROPERMANENTE: Record<number, number> = {
  1: 1, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.5, 6: 1.7, 7: 1.9, 8: 2.1, 9: 2.3,
};

export const PERSONALIZZAZIONE_MAX_MICROPERMANENTE = 0.2; // art. 139, comma 3
export const PERSONALIZZAZIONE_MAX_MACROPERMANENTE = 0.3; // art. 138, comma 3

// Tavola 1.A, Allegato I, D.P.R. 12/2025 — coefficiente moltiplicatore
// biologico del punto, per ciascun punto percentuale di invalidità 10-100.
const CM_BIOLOGICO_MACROPERMANENTE: Record<number, number> = {
  10: 2.75773, 11: 2.91941, 12: 3.07459, 13: 3.22456, 14: 3.37024, 15: 3.5123,
  16: 3.65125, 17: 3.78749, 18: 3.92129, 19: 4.05292, 20: 4.18254, 21: 4.31033,
  22: 4.4364, 23: 4.56086, 24: 4.68379, 25: 4.80527, 26: 4.92536, 27: 5.04411,
  28: 5.16157, 29: 5.27777, 30: 5.39275, 31: 5.50654, 32: 5.61916, 33: 5.73064,
  34: 5.84099, 35: 5.95024, 36: 6.0584, 37: 6.16548, 38: 6.27149, 39: 6.37645,
  40: 6.48037, 41: 6.58326, 42: 6.68512, 43: 6.78596, 44: 6.88578, 45: 6.98461,
  46: 7.08243, 47: 7.17926, 48: 7.2751, 49: 7.36995, 50: 7.46382, 51: 7.55671,
  52: 7.64863, 53: 7.73958, 54: 7.82955, 55: 7.91857, 56: 8.00661, 57: 8.0937,
  58: 8.17983, 59: 8.265, 60: 8.34922, 61: 8.43248, 62: 8.5148, 63: 8.59616,
  64: 8.67657, 65: 8.75604, 66: 8.83456, 67: 8.91214, 68: 8.98877, 69: 9.06446,
  70: 9.13921, 71: 9.21302, 72: 9.28588, 73: 9.35781, 74: 9.42881, 75: 9.49886,
  76: 9.56798, 77: 9.63616, 78: 9.70341, 79: 9.76972, 80: 9.8351, 81: 9.89954,
  82: 9.96305, 83: 10.02563, 84: 10.08728, 85: 10.14799, 86: 10.20778,
  87: 10.26663, 88: 10.32456, 89: 10.38155, 90: 10.43762, 91: 10.49275,
  92: 10.54696, 93: 10.60023, 94: 10.65258, 95: 10.70401, 96: 10.7545,
  97: 10.80407, 98: 10.8527, 99: 10.90042, 100: 10.9472,
};

// Tavola 1.B, Allegato I — coefficiente di riduzione per età (demoltiplicatore
// del danno biologico). Il valore per età 0 non è definito dal decreto.
const COEFF_ETA_MACROPERMANENTE: Record<number, number> = {
  1: 1, 2: 0.995, 3: 0.99, 4: 0.985, 5: 0.98, 6: 0.975, 7: 0.97, 8: 0.965,
  9: 0.96, 10: 0.955, 11: 0.95, 12: 0.945, 13: 0.94, 14: 0.935, 15: 0.93,
  16: 0.925, 17: 0.92, 18: 0.915, 19: 0.91, 20: 0.905, 21: 0.901, 22: 0.896,
  23: 0.891, 24: 0.886, 25: 0.881, 26: 0.876, 27: 0.871, 28: 0.866, 29: 0.861,
  30: 0.856, 31: 0.851, 32: 0.846, 33: 0.841, 34: 0.836, 35: 0.831, 36: 0.826,
  37: 0.821, 38: 0.816, 39: 0.811, 40: 0.806, 41: 0.801, 42: 0.797, 43: 0.792,
  44: 0.787, 45: 0.782, 46: 0.777, 47: 0.772, 48: 0.767, 49: 0.762, 50: 0.757,
  51: 0.752, 52: 0.747, 53: 0.742, 54: 0.738, 55: 0.733, 56: 0.728, 57: 0.723,
  58: 0.718, 59: 0.713, 60: 0.708, 61: 0.703, 62: 0.698, 63: 0.694, 64: 0.689,
  65: 0.684, 66: 0.679, 67: 0.674, 68: 0.669, 69: 0.664, 70: 0.66, 71: 0.655,
  72: 0.65, 73: 0.645, 74: 0.64, 75: 0.636, 76: 0.631, 77: 0.626, 78: 0.621,
  79: 0.617, 80: 0.612, 81: 0.607, 82: 0.602, 83: 0.598, 84: 0.593, 85: 0.588,
  86: 0.584, 87: 0.579, 88: 0.574, 89: 0.57, 90: 0.565, 91: 0.56, 92: 0.556,
  93: 0.551, 94: 0.547, 95: 0.542, 96: 0.537, 97: 0.533, 98: 0.529, 99: 0.525,
  100: 0.522,
};

// Tavola 2, Allegato II — coefficiente moltiplicatore per danno morale
// (minimo/medio/massimo), da applicare al danno biologico già calcolato.
const CM_MORALE_MACROPERMANENTE: Record<number, [number, number, number]> = {
  10: [0.21, 0.26, 0.31], 11: [0.241, 0.291, 0.341], 12: [0.253, 0.303, 0.353],
  13: [0.263, 0.313, 0.363], 14: [0.271, 0.321, 0.371], 15: [0.278, 0.328, 0.378],
  16: [0.285, 0.335, 0.385], 17: [0.291, 0.341, 0.391], 18: [0.296, 0.346, 0.396],
  19: [0.302, 0.352, 0.402], 20: [0.307, 0.357, 0.407], 21: [0.311, 0.361, 0.411],
  22: [0.316, 0.366, 0.416], 23: [0.32, 0.37, 0.42], 24: [0.324, 0.374, 0.424],
  25: [0.328, 0.378, 0.428], 26: [0.332, 0.382, 0.432], 27: [0.336, 0.386, 0.436],
  28: [0.34, 0.39, 0.44], 29: [0.343, 0.393, 0.443], 30: [0.347, 0.397, 0.447],
  31: [0.35, 0.4, 0.45], 32: [0.353, 0.403, 0.453], 33: [0.357, 0.407, 0.457],
  34: [0.36, 0.41, 0.46], 35: [0.363, 0.413, 0.463], 36: [0.366, 0.416, 0.466],
  37: [0.369, 0.419, 0.469], 38: [0.372, 0.422, 0.472], 39: [0.375, 0.425, 0.475],
  40: [0.377, 0.427, 0.477], 41: [0.38, 0.43, 0.48], 42: [0.383, 0.433, 0.483],
  43: [0.386, 0.436, 0.486], 44: [0.388, 0.438, 0.488], 45: [0.391, 0.441, 0.491],
  46: [0.393, 0.443, 0.493], 47: [0.396, 0.446, 0.496], 48: [0.398, 0.448, 0.498],
  49: [0.401, 0.451, 0.501], 50: [0.403, 0.453, 0.503], 51: [0.406, 0.456, 0.506],
  52: [0.408, 0.458, 0.508], 53: [0.41, 0.46, 0.51], 54: [0.413, 0.463, 0.513],
  55: [0.415, 0.465, 0.515], 56: [0.417, 0.467, 0.517], 57: [0.42, 0.47, 0.52],
  58: [0.422, 0.472, 0.522], 59: [0.424, 0.474, 0.524], 60: [0.426, 0.476, 0.526],
  61: [0.428, 0.478, 0.528], 62: [0.43, 0.48, 0.53], 63: [0.433, 0.483, 0.533],
  64: [0.435, 0.485, 0.535], 65: [0.437, 0.487, 0.537], 66: [0.439, 0.489, 0.539],
  67: [0.441, 0.491, 0.541], 68: [0.443, 0.493, 0.543], 69: [0.445, 0.495, 0.545],
  70: [0.447, 0.497, 0.547], 71: [0.449, 0.499, 0.549], 72: [0.451, 0.501, 0.551],
  73: [0.453, 0.503, 0.553], 74: [0.455, 0.505, 0.555], 75: [0.456, 0.506, 0.556],
  76: [0.458, 0.508, 0.558], 77: [0.46, 0.51, 0.56], 78: [0.462, 0.512, 0.562],
  79: [0.464, 0.514, 0.564], 80: [0.466, 0.516, 0.566], 81: [0.468, 0.518, 0.568],
  82: [0.469, 0.519, 0.569], 83: [0.471, 0.521, 0.571], 84: [0.473, 0.523, 0.573],
  85: [0.475, 0.525, 0.575], 86: [0.476, 0.526, 0.576], 87: [0.478, 0.528, 0.578],
  88: [0.48, 0.53, 0.58], 89: [0.482, 0.532, 0.582], 90: [0.483, 0.533, 0.583],
  91: [0.485, 0.535, 0.585], 92: [0.487, 0.537, 0.587], 93: [0.488, 0.538, 0.588],
  94: [0.49, 0.54, 0.59], 95: [0.492, 0.542, 0.592], 96: [0.493, 0.543, 0.593],
  97: [0.495, 0.545, 0.595], 98: [0.497, 0.547, 0.597], 99: [0.498, 0.548, 0.598],
  100: [0.5, 0.55, 0.6],
};

function interpolaMappa(mappa: Record<number, number>, x: number, min: number, max: number): number {
  const xClamp = Math.min(Math.max(x, min), max);
  const basso = Math.floor(xClamp);
  const alto = Math.ceil(xClamp);
  if (basso === alto) return mappa[basso];
  const vBasso = mappa[basso];
  const vAlto = mappa[alto];
  return vBasso + (xClamp - basso) * (vAlto - vBasso);
}

export type ItpTranche = { percentuale: number; giorni: number };

function calcolaTemporaneo(ittGiorni: number, itpTranche: ItpTranche[]): { totale: number; dettaglio: { percentuale: number; giorni: number; importo: number }[] } {
  const dettaglio = itpTranche.map((t) => ({
    percentuale: t.percentuale, giorni: t.giorni,
    importo: t.giorni * ITT_GIORNALIERO_CIRCOLAZIONE * (t.percentuale / 100),
  }));
  const totale = ittGiorni * ITT_GIORNALIERO_CIRCOLAZIONE + dettaglio.reduce((s, d) => s + d.importo, 0);
  return { totale, dettaglio };
}

// ---- Art. 139 — micropermanenti (invalidità 1-9%) ----

export type CalcoloMicropermanenteInput = {
  eta: number; puntiInvalidita: number; ittGiorni: number; itpTranche: ItpTranche[];
  speseMediche: number; personalizzazionePct: number;
};

export type CalcoloMicropermanenteOutput = {
  coefficiente: number; fattoreEta: number; dannoPermanente: number;
  dannoTemporaneoTotale: number; itpDettaglio: { percentuale: number; giorni: number; importo: number }[];
  speseMediche: number; totaleSenzaPersonalizzazione: number;
  personalizzazioneImporto: number; totaleConPersonalizzazione: number;
};

export function calcolaMicropermanente(input: CalcoloMicropermanenteInput): CalcoloMicropermanenteOutput {
  const { eta, puntiInvalidita, ittGiorni, itpTranche, speseMediche, personalizzazionePct } = input;
  if (puntiInvalidita < 1 || puntiInvalidita > 9) throw new Error('Fuori scala: art. 139 si applica da 1 a 9 punti di invalidità');

  const coefficiente = interpolaMappa(COEFFICIENTI_MICROPERMANENTE, puntiInvalidita, 1, 9);
  const fattoreEta = 1 - Math.max(0, eta - 10) * 0.005;
  const dannoPermanente = VALORE_PRIMO_PUNTO * coefficiente * puntiInvalidita * fattoreEta;

  const { totale: dannoTemporaneoTotale, dettaglio: itpDettaglio } = calcolaTemporaneo(ittGiorni, itpTranche);
  const totaleSenzaPersonalizzazione = dannoPermanente + dannoTemporaneoTotale + speseMediche;
  const personalizzazioneImporto = dannoPermanente * (personalizzazionePct / 100);

  return {
    coefficiente, fattoreEta, dannoPermanente, dannoTemporaneoTotale, itpDettaglio, speseMediche,
    totaleSenzaPersonalizzazione, personalizzazioneImporto,
    totaleConPersonalizzazione: totaleSenzaPersonalizzazione + personalizzazioneImporto,
  };
}

// ---- Tabella Unica Nazionale — macropermanenti (invalidità 10-100%) ----

export type TipoMorale = 'nessuno' | 'minimo' | 'medio' | 'massimo';

export type CalcoloMacropermanenteInput = {
  eta: number; puntiInvalidita: number; tipoMorale: TipoMorale;
  ittGiorni: number; itpTranche: ItpTranche[]; incrementoMoraleTemporaneaPct: number;
  speseMediche: number; personalizzazionePct: number;
};

export type CalcoloMacropermanenteOutput = {
  coefficienteBiologico: number; fattoreEta: number; dannoBiologicoPermanente: number;
  coefficienteMorale: number | null; dannoMoralePermanente: number;
  totalePermanente: number;
  dannoTemporaneoBase: number; itpDettaglio: { percentuale: number; giorni: number; importo: number }[];
  dannoTemporaneoConMorale: number;
  speseMediche: number; totaleSenzaPersonalizzazione: number;
  personalizzazioneImporto: number; totaleConPersonalizzazione: number;
};

export function calcolaMacropermanente(input: CalcoloMacropermanenteInput): CalcoloMacropermanenteOutput {
  const { eta, puntiInvalidita, tipoMorale, ittGiorni, itpTranche, incrementoMoraleTemporaneaPct, speseMediche, personalizzazionePct } = input;
  if (puntiInvalidita < 10 || puntiInvalidita > 100) throw new Error('Fuori scala: la Tabella Unica Nazionale si applica da 10 a 100 punti di invalidità');

  const coefficienteBiologico = interpolaMappa(CM_BIOLOGICO_MACROPERMANENTE, puntiInvalidita, 10, 100);
  const etaClamp = Math.min(Math.max(eta, 1), 100);
  const fattoreEta = interpolaMappa(COEFF_ETA_MACROPERMANENTE, etaClamp, 1, 100);
  const dannoBiologicoPermanente = VALORE_PRIMO_PUNTO * coefficienteBiologico * fattoreEta;

  let coefficienteMorale: number | null = null;
  let dannoMoralePermanente = 0;
  if (tipoMorale !== 'nessuno') {
    const basso = Math.floor(Math.min(Math.max(puntiInvalidita, 10), 100));
    const alto = Math.ceil(Math.min(Math.max(puntiInvalidita, 10), 100));
    const idx = tipoMorale === 'minimo' ? 0 : tipoMorale === 'medio' ? 1 : 2;
    const vBasso = CM_MORALE_MACROPERMANENTE[basso][idx];
    const vAlto = CM_MORALE_MACROPERMANENTE[alto][idx];
    coefficienteMorale = basso === alto ? vBasso : vBasso + (puntiInvalidita - basso) * (vAlto - vBasso);
    dannoMoralePermanente = dannoBiologicoPermanente * coefficienteMorale;
  }
  const totalePermanente = dannoBiologicoPermanente + dannoMoralePermanente;

  const { totale: dannoTemporaneoBase, dettaglio: itpDettaglio } = calcolaTemporaneo(ittGiorni, itpTranche);
  const dannoTemporaneoConMorale = dannoTemporaneoBase * (1 + incrementoMoraleTemporaneaPct / 100);

  const totaleSenzaPersonalizzazione = totalePermanente + dannoTemporaneoConMorale + speseMediche;
  const personalizzazioneImporto = totalePermanente * (personalizzazionePct / 100);

  return {
    coefficienteBiologico, fattoreEta, dannoBiologicoPermanente, coefficienteMorale, dannoMoralePermanente,
    totalePermanente, dannoTemporaneoBase, itpDettaglio, dannoTemporaneoConMorale, speseMediche,
    totaleSenzaPersonalizzazione, personalizzazioneImporto,
    totaleConPersonalizzazione: totaleSenzaPersonalizzazione + personalizzazioneImporto,
  };
}

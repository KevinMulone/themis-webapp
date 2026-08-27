/**
 * Parametri per la liquidazione dei compensi per la professione forense.
 *
 * D.M. 10 marzo 2014, n. 55, come sostituito dal D.M. 13 agosto 2022, n. 147
 * (G.U. n. 236 del 8.10.2022, in vigore dal 23.10.2022): l'art. 5 del D.M.
 * 147/2022 dispone che le tabelle allegate al D.M. 55/2014 "sono sostituite
 * da quelle allegate al presente regolamento". I valori qui riportati sono
 * quindi quelli attualmente vigenti (non quelli, più bassi, del D.M. 37/2018).
 *
 * Sono di regola aumentabili fino al 50% e diminuibili non oltre il 50%
 * (art. 4, comma 1, per l'attività giudiziale; art. 19 per la stragiudiziale).
 * Sono valori MEDI per l'uso giudiziale della liquidazione; restano un
 * riferimento, non un automatismo: la loro applicazione a un caso concreto
 * è sempre una valutazione dell'avvocato.
 *
 * Sono incluse le tabelle più rilevanti per l'attività dello studio
 * (tribunale ordinario, lavoro, previdenza, ATP, stragiudiziale,
 * mediazione/negoziazione assistita). Tabelle più specialistiche (Cassazione,
 * TAR, Consiglio di Stato, tributario, arbitrato, esecuzioni, fallimentare)
 * non sono incluse in questa prima versione.
 */

export type ScaglioneRange = { min: number; max: number };

export type TabellaCompensi = {
  id: string;
  nome: string;
  riferimento: string;
  fasi: string[];
  scaglioni: ScaglioneRange[];
  // valori[indiceFase][indiceScaglione]
  valori: number[][];
};

const SCAGLIONI_STANDARD: ScaglioneRange[] = [
  { min: 0.01, max: 1_100 },
  { min: 1_100.01, max: 5_200 },
  { min: 5_200.01, max: 26_000 },
  { min: 26_000.01, max: 52_000 },
  { min: 52_000.01, max: 260_000 },
  { min: 260_000.01, max: 520_000 },
];

const SCAGLIONI_GIUDICE_DI_PACE: ScaglioneRange[] = SCAGLIONI_STANDARD.slice(0, 3);

const SCAGLIONI_ATP: ScaglioneRange[] = [
  { min: 0, max: 5_200 },
  { min: 5_200.01, max: 26_000 },
  { min: 26_000.01, max: 52_000 },
  { min: 52_000.01, max: 260_000 },
  { min: 260_000.01, max: 520_000 },
];

export const TABELLE: TabellaCompensi[] = [
  {
    id: 'giudice_di_pace',
    nome: 'Giudizi davanti al Giudice di Pace',
    riferimento: 'Tabella 1, D.M. 55/2014 come sost. dal D.M. 147/2022',
    fasi: ['Fase di studio della controversia', 'Fase introduttiva del giudizio', 'Fase istruttoria e/o di trattazione', 'Fase decisionale'],
    scaglioni: SCAGLIONI_GIUDICE_DI_PACE,
    valori: [
      [68, 236, 425],
      [68, 252, 352],
      [68, 352, 567],
      [142, 425, 746],
    ],
  },
  {
    id: 'tribunale_ordinario',
    nome: 'Giudizi ordinari e sommari di cognizione innanzi al Tribunale',
    riferimento: 'Tabella 2, D.M. 55/2014 come sost. dal D.M. 147/2022',
    fasi: ['Fase di studio della controversia', 'Fase introduttiva del giudizio', 'Fase istruttoria e/o di trattazione', 'Fase decisionale'],
    scaglioni: SCAGLIONI_STANDARD,
    valori: [
      [131, 425, 919, 1_701, 2_552, 3_544],
      [131, 425, 777, 1_204, 1_628, 2_338],
      [200, 851, 1_680, 1_806, 5_670, 10_411],
      [200, 851, 1_701, 2_905, 4_253, 6_164],
    ],
  },
  {
    id: 'cause_lavoro',
    nome: 'Cause di lavoro',
    riferimento: 'Tabella 3, D.M. 55/2014 come sost. dal D.M. 147/2022',
    fasi: ['Fase di studio della controversia', 'Fase introduttiva del giudizio', 'Fase istruttoria e/o di trattazione', 'Fase decisionale'],
    scaglioni: SCAGLIONI_STANDARD,
    valori: [
      [210, 888, 1_822, 3_245, 4_763, 6_668],
      [126, 425, 777, 1_202, 1_701, 2_336],
      [126, 567, 1_172, 1_880, 2_678, 3_623],
      [179, 746, 1_617, 2_930, 4_253, 6_290],
    ],
  },
  {
    id: 'cause_previdenza',
    nome: 'Cause di previdenza (es. ricorsi INPS)',
    riferimento: 'Tabella 4, D.M. 55/2014 come sost. dal D.M. 147/2022',
    fasi: ['Fase di studio della controversia', 'Fase introduttiva del giudizio', 'Fase istruttoria e/o di trattazione', 'Fase decisionale'],
    scaglioni: SCAGLIONI_STANDARD,
    valori: [
      [131, 425, 929, 1_701, 2_552, 3_544],
      [121, 425, 777, 1_204, 1_701, 2_336],
      [179, 851, 1_664, 2_693, 3_827, 5_171],
      [247, 919, 2_021, 3_675, 4_148, 7_865],
    ],
  },
  {
    id: 'istruzione_preventiva',
    nome: 'Procedimenti di istruzione preventiva (es. ATP invalidità civile)',
    riferimento: 'Tabella 9, D.M. 55/2014 come sost. dal D.M. 147/2022',
    fasi: ['Fase di studio della controversia', 'Fase introduttiva del giudizio', 'Fase istruttoria'],
    scaglioni: SCAGLIONI_ATP,
    valori: [
      [210, 567, 992, 1_134, 2_126],
      [284, 709, 788, 992, 1_454],
      [352, 1_061, 1_276, 1_701, 2_336],
    ],
  },
  {
    id: 'stragiudiziale',
    nome: 'Assistenza stragiudiziale (compenso unico onnicomprensivo)',
    riferimento: 'Tabella 25, D.M. 55/2014 come sost. dal D.M. 147/2022 (art. 18-19)',
    fasi: ['Compenso'],
    scaglioni: SCAGLIONI_STANDARD,
    valori: [
      [284, 1_276, 1_985, 2_410, 4_536, 6_164],
    ],
  },
  {
    id: 'mediazione_negoziazione',
    nome: 'Procedimento di mediazione e negoziazione assistita',
    riferimento: 'Tabella 25-bis, D.M. 55/2014 come sost. dal D.M. 147/2022 (art. 20, comma 1-bis)',
    fasi: ['Fase della attivazione', 'Fase di negoziazione', 'Conciliazione'],
    scaglioni: SCAGLIONI_STANDARD,
    valori: [
      [63, 284, 441, 536, 1_008, 1_370],
      [126, 567, 882, 1_071, 2_016, 2_741],
      [246, 1_106, 1_720, 2_088, 3_931, 5_343],
    ],
  },
];

export function trovaScaglione(valore: number, scaglioni: ScaglioneRange[]): { indice: number; oltreTetto: boolean } {
  for (let i = 0; i < scaglioni.length; i++) {
    if (valore <= scaglioni[i].max) return { indice: i, oltreTetto: false };
  }
  return { indice: scaglioni.length - 1, oltreTetto: true };
}

export type RigaCompenso = { fase: string; base: number; importo: number };

export type CalcoloCompensiOutput = {
  scaglioneIndice: number;
  oltreTetto: boolean;
  righe: RigaCompenso[];
  compensoBase: number;
  compensoConVariazione: number;
  rimborsoForfettario: number;
  cpa: number;
  iva: number;
  totaleFattura: number;
};

const RIMBORSO_FORFETTARIO_PCT = 15;
const CPA_PCT = 4;
const IVA_PCT = 22;

export function calcolaCompensi(params: {
  tabella: TabellaCompensi;
  valore: number;
  fasiSelezionate: boolean[];
  variazionePct: number;
  includiRimborsoForfettario: boolean;
  includiCpa: boolean;
  includiIva: boolean;
}): CalcoloCompensiOutput {
  const { tabella, valore, fasiSelezionate, variazionePct, includiRimborsoForfettario, includiCpa, includiIva } = params;
  const { indice, oltreTetto } = trovaScaglione(valore, tabella.scaglioni);

  const righe: RigaCompenso[] = tabella.fasi
    .map((fase, i) => ({ fase, base: tabella.valori[i][indice], selezionata: fasiSelezionate[i] }))
    .filter((r) => r.selezionata)
    .map((r) => ({ fase: r.fase, base: r.base, importo: r.base * (1 + variazionePct / 100) }));

  const compensoBase = righe.reduce((s, r) => s + r.base, 0);
  const compensoConVariazione = righe.reduce((s, r) => s + r.importo, 0);

  const rimborsoForfettario = includiRimborsoForfettario ? compensoConVariazione * (RIMBORSO_FORFETTARIO_PCT / 100) : 0;
  const imponibile = compensoConVariazione + rimborsoForfettario;
  const cpa = includiCpa ? imponibile * (CPA_PCT / 100) : 0;
  const iva = includiIva ? (imponibile + cpa) * (IVA_PCT / 100) : 0;
  const totaleFattura = imponibile + cpa + iva;

  return { scaglioneIndice: indice, oltreTetto, righe, compensoBase, compensoConVariazione, rimborsoForfettario, cpa, iva, totaleFattura };
}

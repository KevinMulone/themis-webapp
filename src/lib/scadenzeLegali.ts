/**
 * Scadenze legali suggerite per tipo di pratica.
 *
 * Ogni regola calcola una scadenza a partire da una data di riferimento
 * scelta dall'utente (es. data del sinistro, data di notifica) sommando un
 * numero di giorni, con riferimento normativo esplicito. Sono SUGGERIMENTI
 * con riferimento di legge verificabile, non automatismi ciechi: la materia
 * ha molte eccezioni (reati con prescrizione più lunga, termini speciali,
 * sospensioni per altre cause) che solo l'avvocato può valutare sul caso
 * concreto. La data calcolata resta sempre modificabile prima di salvarla.
 *
 * Principio applicato per la sospensione feriale: si attiva SOLO sui termini
 * processuali in senso stretto (atti da compiere in un giudizio pendente:
 * impugnazioni, opposizioni, termini esecutivi). Non si applica mai alla
 * prescrizione né ai termini di decadenza sostanziale del codice civile
 * (che decorrono in modo continuo, salvo le cause di sospensione/interruzione
 * tassative previste dal codice civile stesso), né ai termini di procedimenti
 * stragiudiziali (mediazione, negoziazione assistita) prima che sia pendente
 * un giudizio.
 */

// Sospensione feriale dei termini processuali: dal 1 al 31 agosto compresi
// (L. 742/1969, art. 1). Non si applica alle controversie di lavoro e
// previdenza (art. 3, comma 1, L. 742/1969, come modificato dalla L. 162/2014).
function sovrapponeAgosto(dataInizio: Date, dataFineGrezza: Date, anno: number): boolean {
  const inizioAgosto = new Date(anno, 7, 1); // mese 7 = agosto (0-based)
  const fineAgosto = new Date(anno, 7, 31);
  return dataInizio <= fineAgosto && dataFineGrezza >= inizioAgosto;
}

export { toIsoLocale } from './dateUtils';

function addGiorni(data: Date, giorni: number): Date {
  const d = new Date(data);
  d.setDate(d.getDate() + giorni);
  return d;
}

export function calcolaScadenza(dataInizio: Date, giorni: number, applicaSospensioneFeriale: boolean): Date {
  let scadenza = addGiorni(dataInizio, giorni);
  if (!applicaSospensioneFeriale) return scadenza;
  // Applica +31 giorni per ogni agosto (di qualunque anno) attraversato dal periodo.
  let cambiato = true;
  const anniGiaApplicati = new Set<number>();
  while (cambiato) {
    cambiato = false;
    for (let anno = dataInizio.getFullYear(); anno <= scadenza.getFullYear(); anno++) {
      if (anniGiaApplicati.has(anno)) continue;
      if (sovrapponeAgosto(dataInizio, scadenza, anno)) {
        scadenza = addGiorni(scadenza, 31);
        anniGiaApplicati.add(anno);
        cambiato = true;
      }
    }
  }
  return scadenza;
}

export type RegolaScadenza = {
  id: string;
  label: string;
  giorni: number;
  sospensioneFeriale: boolean;
  riferimento: string;
};

export type GruppoScadenze = {
  categoria: string;
  regole: RegolaScadenza[];
};

// Organizzate per area della pratica, non per il campo tipo_pratica in senso
// stretto: molte pratiche (es. "causa civile", "sinistro") coprono situazioni
// diverse con termini diversi, per cui è l'avvocato a scegliere quali
// scadenze proporsi in base al caso concreto.
export const GRUPPI_SCADENZE: GruppoScadenze[] = [
  {
    categoria: 'Sinistri e responsabilità civile',
    regole: [
      { id: 'sin_prescrizione_rca', label: 'Prescrizione danni da circolazione (RCA)', giorni: 730, sospensioneFeriale: false, riferimento: 'Art. 2947, comma 2, c.c. — 2 anni dal sinistro. Prescrizione sostanziale: non sospesa dalla sospensione feriale, che riguarda solo termini processuali' },
      { id: 'sin_prescrizione_generica', label: 'Prescrizione responsabilità extracontrattuale generica', giorni: 1826, sospensioneFeriale: false, riferimento: 'Art. 2947, comma 1, c.c. — 5 anni dal fatto. Prescrizione sostanziale: non sospesa dalla sospensione feriale' },
      { id: 'sin_risposta_compagnia', label: 'Termine risposta compagnia a richiesta danni RCA', giorni: 60, sospensioneFeriale: false, riferimento: 'Art. 148 Cod. Ass. (D.Lgs. 209/2005) — 60 gg (90 se necessita CTU) dalla richiesta completa; termine amministrativo, non processuale' },
      { id: 'sin_neg_assistita', label: 'Termine risposta invito a negoziazione assistita', giorni: 30, sospensioneFeriale: false, riferimento: 'Art. 4 D.L. 132/2014 conv. L. 162/2014; termine stragiudiziale, non ancora pendente un giudizio' },
    ],
  },
  {
    categoria: 'ATP invalidità civile',
    regole: [
      { id: 'atp_memorie_ctu', label: 'Termine per osservazioni alla relazione CTU', giorni: 30, sospensioneFeriale: false, riferimento: 'Art. 195 c.p.c. — termine di regola fissato dal giudice, salvo diversa indicazione; materia previdenziale, non soggetta a sospensione feriale' },
      { id: 'atp_giudizio_merito', label: 'Introduzione giudizio di merito dopo mancata omologa', giorni: 30, sospensioneFeriale: false, riferimento: 'Art. 445-bis, comma 5, c.p.c. — 30 gg dal deposito della relazione o dalla scadenza del termine per le osservazioni' },
    ],
  },
  {
    categoria: 'Ricorsi INPS',
    regole: [
      { id: 'inps_ricorso_reiezione', label: 'Ricorso contro verbale di reiezione invalidità civile', giorni: 180, sospensioneFeriale: false, riferimento: 'Art. 42, comma 3, D.L. 269/2003 conv. L. 326/2003 — termine di decadenza di 6 mesi; materia previdenziale, non soggetta a sospensione feriale' },
    ],
  },
  {
    categoria: 'Diritto del lavoro',
    regole: [
      { id: 'lav_impugnazione_stragiudiziale', label: 'Impugnazione stragiudiziale del licenziamento', giorni: 60, sospensioneFeriale: false, riferimento: 'Art. 6, comma 1, L. 604/1966 — 60 gg dalla comunicazione; materia di lavoro, non soggetta a sospensione feriale' },
      { id: 'lav_deposito_ricorso', label: 'Deposito ricorso giudiziale dopo impugnazione stragiudiziale', giorni: 180, sospensioneFeriale: false, riferimento: 'Art. 6, comma 2, L. 604/1966 — 180 gg dall\'impugnazione stragiudiziale; materia di lavoro, non soggetta a sospensione feriale' },
    ],
  },
  {
    categoria: 'Cause civili ed esecuzioni',
    regole: [
      { id: 'civ_opposizione_di', label: 'Opposizione a decreto ingiuntivo', giorni: 40, sospensioneFeriale: true, riferimento: 'Art. 641 c.p.c. — termine ordinario di 40 gg dalla notifica (può variare se il giudice ne fissa uno diverso)' },
      { id: 'civ_efficacia_precetto', label: 'Scadenza efficacia del precetto', giorni: 90, sospensioneFeriale: true, riferimento: 'Art. 481 c.p.c. — 90 gg dalla notifica' },
      { id: 'civ_prescrizione_ordinaria', label: 'Prescrizione ordinaria (contratti)', giorni: 3652, sospensioneFeriale: false, riferimento: 'Art. 2946 c.c. — 10 anni. Prescrizione sostanziale: non sospesa dalla sospensione feriale' },
    ],
  },
  {
    categoria: 'Successioni',
    regole: [
      { id: 'succ_inventario', label: 'Termine per fare l\'inventario (chiamato in possesso di beni)', giorni: 90, sospensioneFeriale: false, riferimento: 'Art. 485 c.c. — 3 mesi dall\'apertura della successione; termine sostanziale del codice civile, non processuale' },
      { id: 'succ_prescrizione_accettazione', label: 'Prescrizione del diritto di accettare l\'eredità', giorni: 3652, sospensioneFeriale: false, riferimento: 'Art. 480 c.c. — 10 anni dall\'apertura della successione. Prescrizione sostanziale: non sospesa dalla sospensione feriale' },
    ],
  },
  {
    categoria: 'Gratuito patrocinio',
    regole: [
      { id: 'pss_opposizione_decreto', label: 'Opposizione al decreto di liquidazione del compenso', giorni: 20, sospensioneFeriale: true, riferimento: 'Art. 170, comma 1, D.P.R. 115/2002 (rinvio all\'art. 15 D.Lgs. 150/2011) — 20 gg dalla comunicazione del decreto' },
    ],
  },
  {
    categoria: 'Penale',
    regole: [
      { id: 'pen_querela', label: 'Termine per proporre querela', giorni: 90, sospensioneFeriale: false, riferimento: 'Art. 124 c.p. — 3 mesi dalla notizia del fatto (termine sostanziale, salvo termini speciali per singoli reati, es. 12 mesi per violenza sessuale)' },
    ],
  },
  {
    categoria: 'Immigrazione',
    regole: [
      { id: 'imm_ricorso_diniego', label: 'Ricorso contro diniego protezione internazionale', giorni: 30, sospensioneFeriale: true, riferimento: 'Art. 35-bis D.Lgs. 25/2008 — 30 gg dalla notifica (15 gg se il richiedente è trattenuto)' },
    ],
  },
  {
    categoria: 'Mediazione e condominio',
    regole: [
      { id: 'med_primo_incontro', label: 'Primo incontro di mediazione', giorni: 30, sospensioneFeriale: false, riferimento: 'Art. 8 D.Lgs. 28/2010 — entro 30 gg dal deposito della domanda; procedimento stragiudiziale, non soggetto a sospensione feriale' },
      { id: 'med_durata_max', label: 'Durata massima del procedimento di mediazione', giorni: 90, sospensioneFeriale: false, riferimento: 'Art. 6 D.Lgs. 28/2010 — 3 mesi dal deposito della domanda; procedimento stragiudiziale, non soggetto a sospensione feriale' },
      { id: 'cond_impugnazione_delibera', label: 'Impugnazione delibera assembleare', giorni: 30, sospensioneFeriale: false, riferimento: 'Art. 1137 c.c. — 30 gg dalla delibera (dissenzienti/astenuti) o dalla comunicazione (assenti); termine sostanziale di decadenza, non processuale' },
    ],
  },
  {
    categoria: 'Termini generali',
    regole: [
      { id: 'gen_prescrizione_10', label: 'Prescrizione ordinaria', giorni: 3652, sospensioneFeriale: false, riferimento: 'Art. 2946 c.c. — 10 anni, salvo prescrizioni brevi previste per singole fattispecie. Prescrizione sostanziale: non sospesa dalla sospensione feriale' },
      { id: 'gen_prescrizione_5', label: 'Prescrizione breve', giorni: 1826, sospensioneFeriale: false, riferimento: 'Es. art. 2947 c.c. e altre ipotesi di prescrizione quinquennale. Prescrizione sostanziale: non sospesa dalla sospensione feriale' },
    ],
  },
];

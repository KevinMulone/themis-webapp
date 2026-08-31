/**
 * Catalogo degli atti che si sanno impostare.
 *
 * La struttura di ogni tipo non è decorazione: è ciò che distingue un
 * testo che sembra un atto da un testo che è un atto. Chiedere
 * genericamente «scrivi un atto di citazione» produce prosa plausibile e
 * senza epigrafe, senza vocatio in ius, senza dichiarazione di valore.
 * Dettare le sezioni una per una è il modo più economico di alzare la
 * qualità: costa qualche riga qui e nulla in token.
 */

export type TipoAtto = {
  chiave: string;
  label: string;
  /** Testo dell'aiuto sotto la tendina. */
  aiuto: string;
  struttura: string;
};

export const TIPI_ATTO: TipoAtto[] = [
  {
    chiave: 'diffida',
    label: 'Diffida e messa in mora',
    aiuto: 'Lettera alla controparte: intimazione ad adempiere con termine.',
    struttura: `Lettera stragiudiziale indirizzata alla controparte. Sezioni, nell'ordine:
1. Destinatario e, se noto, indirizzo o PEC.
2. Oggetto sintetico.
3. Premesse in fatto, numerate, ciascuna asciutta e verificabile.
4. Qualificazione giuridica sintetica dell'inadempimento.
5. Formale diffida e messa in mora, con termine espresso per adempiere.
6. Avvertimento sulle conseguenze del mancato riscontro.
7. Riserva di ogni azione e di ogni ulteriore danno.
8. Luogo, data e sottoscrizione del difensore.`,
  },
  {
    chiave: 'richiesta_risarcimento',
    label: 'Richiesta di risarcimento danni',
    aiuto: 'Apertura sinistro o richiesta alla compagnia assicurativa.',
    struttura: `Lettera alla compagnia assicurativa (o al danneggiante). Sezioni:
1. Destinatario, numero di sinistro e di polizza se risultano dal fascicolo.
2. Oggetto con nome del danneggiato e data del fatto.
3. Dinamica del fatto, in fatto e per come risulta dagli atti.
4. Individuazione della responsabilità.
5. Lesioni riportate e documentazione sanitaria disponibile.
6. Voci di danno richieste, distinte una per una.
7. Richiesta di riscontro e di formulazione dell'offerta nei termini di legge.
8. Elenco degli allegati.
9. Luogo, data e sottoscrizione.`,
  },
  {
    chiave: 'negoziazione',
    label: 'Invito a negoziazione assistita',
    aiuto: 'Invito a stipulare la convenzione di negoziazione assistita.',
    struttura: `Invito alla stipula di una convenzione di negoziazione assistita. Sezioni:
1. Destinatario.
2. Indicazione dell'oggetto della controversia.
3. Esposizione sintetica dei fatti e delle pretese.
4. Invito formale a stipulare la convenzione, con termine per aderire.
5. Avvertimento sulle conseguenze della mancata risposta o del rifiuto.
6. Indicazione del difensore che assiste la parte invitante.
7. Luogo, data e sottoscrizione.`,
  },
  {
    chiave: 'citazione',
    label: 'Atto di citazione',
    aiuto: 'Atto introduttivo del giudizio ordinario.',
    struttura: `Atto di citazione. Sezioni, nell'ordine e con le intestazioni in maiuscolo:
1. Epigrafe: autorità giudiziaria adita; "PER" con attore, dati anagrafici, codice fiscale, difensore e riferimento alla procura; "CONTRO" con il convenuto e i suoi dati.
2. FATTO: esposizione numerata e cronologica, ogni capoverso un fatto.
3. DIRITTO: qualificazione giuridica della domanda.
4. In via istruttoria: mezzi di prova che si intendono articolare.
5. CONCLUSIONI: domande rivolte al giudice, numerate, con spese e competenze.
6. Vocatio in ius: invito a costituirsi nel termine di legge con avvertimento delle decadenze.
7. Dichiarazione di valore ai fini del contributo unificato.
8. Elenco degli allegati.
9. Luogo, data e sottoscrizione del difensore.`,
  },
  {
    chiave: 'ricorso_atp',
    label: 'Ricorso per ATP (previdenziale)',
    aiuto: 'Accertamento tecnico preventivo in materia di invalidità.',
    struttura: `Ricorso per accertamento tecnico preventivo in materia previdenziale e assistenziale. Sezioni:
1. Epigrafe: Tribunale adito, sezione lavoro; ricorrente con dati e codice fiscale; ente resistente.
2. FATTO: domanda amministrativa presentata, esito, verbali sanitari con le date, patologie accertate.
3. Quadro clinico attuale e ragioni per cui il giudizio dell'ente non è condiviso.
4. DIRITTO: requisiti sanitari e, se pertinenti, socio-economici della prestazione richiesta.
5. CONCLUSIONI: richiesta di nomina del consulente tecnico d'ufficio con il quesito.
6. Eventuale istanza di ammissione al patrocinio o di esenzione dal contributo unificato, se dal fascicolo risulta che ne ricorrono i presupposti.
7. Elenco degli allegati, numerato.
8. Luogo, data e sottoscrizione.`,
  },
  {
    chiave: 'ricorso_amministrativo',
    label: 'Ricorso amministrativo a ente',
    aiuto: 'Ricorso o opposizione in via amministrativa (INPS, Comune, ASP).',
    struttura: `Ricorso in via amministrativa all'ente che ha adottato il provvedimento. Sezioni:
1. Ente destinatario e riferimenti del provvedimento impugnato (numero e data).
2. Ricorrente con dati anagrafici e codice fiscale.
3. FATTO: iter della pratica, dal primo atto al provvedimento contestato.
4. MOTIVI: le ragioni di contestazione, una per capoverso, ciascuna autonoma.
5. CONCLUSIONI: cosa si chiede all'ente.
6. Elenco degli allegati.
7. Luogo, data e sottoscrizione.`,
  },
  {
    chiave: 'memoria',
    label: 'Memoria difensiva',
    aiuto: 'Memoria, comparsa o note nel corso del giudizio.',
    struttura: `Memoria difensiva da depositare nel giudizio pendente. Sezioni:
1. Epigrafe con autorità giudiziaria, numero di ruolo, parti e difensore.
2. Premessa sullo stato del giudizio.
3. Svolgimento della difesa, per punti autonomi e numerati.
4. Replica puntuale alle difese avversarie, se risultano dagli atti.
5. CONCLUSIONI: riproposizione o precisazione delle domande.
6. Luogo, data e sottoscrizione.`,
  },
  {
    chiave: 'istanza',
    label: 'Istanza al giudice',
    aiuto: 'Istanza endoprocessuale (rinvio, CTU, acquisizione documenti).',
    struttura: `Istanza rivolta al giudice della causa. Sezioni:
1. Epigrafe con autorità, numero di ruolo, parti e difensore istante.
2. Premesse: stato del procedimento e ragione dell'istanza.
3. CHIEDE: il provvedimento richiesto, formulato in modo preciso.
4. Luogo, data e sottoscrizione.
Va tenuta breve: un'istanza lunga è un'istanza mal scritta.`,
  },
  {
    chiave: 'relazione',
    label: 'Relazione al cliente',
    aiuto: 'Riepilogo della pratica in linguaggio comprensibile al cliente.',
    struttura: `Relazione informativa destinata al cliente, non al giudice. Sezioni:
1. Di cosa si occupa la pratica, in una frase.
2. Cosa è successo finora, in ordine di tempo.
3. A che punto siamo oggi.
4. Cosa succederà, con i tempi prevedibili.
5. Cosa serve dal cliente.
Registro diverso dagli atti: frasi brevi, niente latino, niente formule di rito. Se un termine tecnico è inevitabile, va spiegato fra parentesi.`,
  },
  {
    chiave: 'libero',
    label: 'Altro (descrivi tu)',
    aiuto: "Descrivi nelle istruzioni che atto serve e come va impostato.",
    struttura: `Il tipo di atto non è fra quelli predefiniti: segui le istruzioni del difensore per la struttura, mantenendo il registro forense e le regole sui fatti e sui riferimenti normativi.`,
  },
];

export function tipoAtto(chiave: string): TipoAtto | undefined {
  return TIPI_ATTO.find((t) => t.chiave === chiave);
}

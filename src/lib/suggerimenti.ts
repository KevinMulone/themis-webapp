/**
 * Testi di aiuto sotto i campi, e valori proposti nelle tendine.
 *
 * Criterio: si spiega solo ciò che non è ovvio. "Email" o "Telefono" non
 * hanno bisogno di didascalia; "R.G." o "IP %" sì, perché chi non lo usa
 * tutti i giorni non sa cosa scriverci né in che formato.
 */

/** Compagnie con cui lo studio lavora più spesso. Non è un elenco chiuso:
 *  serve come suggerimento, il campo resta scrivibile a mano. */
export const COMPAGNIE_ASSICURATIVE = [
  'Generali', 'UnipolSai', 'Allianz', 'AXA', 'Zurich', 'SARA Assicurazioni',
  'HDI Assicurazioni', 'Vittoria Assicurazioni', 'PRIMA Assicurazioni',
  'Reale Mutua', 'Groupama', 'ITAS', 'Cattolica', 'Quixa', 'Verti', 'ConTe.it',
  'Genertel', 'Linear', 'Direct Line', 'Amissima', 'Assimoco', 'Tua Assicurazioni',
];

/** Uffici giudiziari ricorrenti, con quelli siciliani in testa. */
/**
 * Fori da offrire come suggerimento nei moduli.
 *
 * Sono i capoluoghi di provincia (con il nome corretto della sede, non
 * quello della provincia: Trani e non Barletta-Andria-Trani) più le sedi
 * non capoluogo che lo studio già usa.
 *
 * NON è l'elenco ufficiale completo dei circondari di tribunale: non sono
 * riuscito a procurarmelo da una fonte attendibile, e ricostruirlo a
 * memoria farebbe ricomparire sedi soppresse dalla riforma della
 * geografia giudiziaria — un errore che in un atto si paga. Il campo
 * resta scrivibile a mano: una sede mancante non blocca nulla, si
 * aggiunge qui quando serve.
 */
export const FORI = [
  'Agrigento', 'Alessandria', 'Ancona', 'Aosta', 'Arezzo', 'Ascoli Piceno',
  'Asti', 'Avellino', 'Barcellona P.G.', 'Bari', 'Belluno', 'Benevento',
  'Bergamo', 'Biella', 'Bologna', 'Bolzano', 'Brescia', 'Brindisi',
  'Cagliari', 'Caltanissetta', 'Campobasso', 'Caserta', 'Catania',
  'Catanzaro', 'Chieti', 'Como', 'Cosenza', 'Cremona', 'Crotone', 'Cuneo',
  'Enna', 'Fermo', 'Ferrara', 'Firenze', 'Foggia', 'Forlì', 'Frosinone',
  'Gela', 'Genova', 'Gorizia', 'Grosseto', 'Imperia', 'Isernia', 'L\'Aquila',
  'La Spezia', 'Latina', 'Lecce', 'Lecco', 'Livorno', 'Lodi', 'Lucca',
  'Macerata', 'Mantova', 'Marsala', 'Massa', 'Matera', 'Messina', 'Milano',
  'Modena', 'Monza', 'Napoli', 'Novara', 'Nuoro', 'Oristano', 'Padova',
  'Palermo', 'Parma', 'Patti', 'Pavia', 'Perugia', 'Pesaro', 'Pescara',
  'Piacenza', 'Pisa', 'Pistoia', 'Pordenone', 'Potenza', 'Prato', 'Ragusa',
  'Ravenna', 'Reggio Calabria', 'Reggio Emilia', 'Rieti', 'Rimini', 'Roma',
  'Rovigo', 'Salerno', 'Sassari', 'Savona', 'Sciacca', 'Siena', 'Siracusa',
  'Sondrio', 'Taranto', 'Teramo', 'Termini Imerese', 'Terni', 'Torino',
  'Trani', 'Trapani', 'Trento', 'Treviso', 'Trieste', 'Udine', 'Varese',
  'Venezia', 'Verbania', 'Vercelli', 'Verona', 'Vibo Valentia', 'Vicenza',
  'Viterbo',
];

export const TRIBUNALI = [
  'Tribunale di Caltanissetta', 'Tribunale di Catania', 'Tribunale di Enna',
  'Tribunale di Agrigento', 'Tribunale di Gela', 'Tribunale di Siracusa',
  'Tribunale di Ragusa', 'Tribunale di Messina', 'Tribunale di Palermo',
  'Tribunale di Termini Imerese', 'Tribunale di Marsala', 'Tribunale di Trapani',
  'Tribunale di Sciacca', 'Tribunale di Patti', 'Tribunale di Barcellona P.G.',
  'Corte d’Appello di Caltanissetta', 'Corte d’Appello di Catania',
  'Corte d’Appello di Palermo', 'Corte d’Appello di Messina',
  'Giudice di Pace di Caltanissetta', 'Giudice di Pace di Catania',
  'Giudice di Pace di Gela', 'Giudice di Pace di Enna',
];

export const SEZIONI = [
  'Sezione Civile', 'Prima Sezione Civile', 'Seconda Sezione Civile', 'Terza Sezione Civile',
  'Sezione Lavoro e Previdenza', 'Sezione Volontaria Giurisdizione',
  'Sezione Fallimentare', 'Sezione Esecuzioni Mobiliari', 'Sezione Esecuzioni Immobiliari',
  'Sezione Penale', 'Sezione Distaccata',
];

/**
 * Aiuto per i campi a nome fisso delle schede pratica e sinistro.
 * Le chiavi sono i nomi delle colonne.
 */
export const AIUTO_CAMPI: Record<string, string> = {
  controparte_nome: 'Chi sta dall’altra parte: persona, azienda o ente',
  numero_riferimento: 'Il riferimento con cui la pratica è nota fuori dallo studio (protocollo, pratica assicurativa)',
  rg_numero: 'Solo il numero, senza l’anno',
  rg_anno: 'Anno di iscrizione a ruolo, per esteso (2026)',
  sezione: 'Sezione del tribunale, se assegnata',
  giudice: 'Cognome del giudice assegnatario',

  numero_sinistro_compagnia: 'Il numero che la compagnia usa per questo sinistro, riportato sulle sue lettere',
  liquidatore_nome: 'Chi tratta la pratica in compagnia',
  liquidatore_contatti: 'Telefono o email diretti del liquidatore',
  ip_percentuale: 'Invalidità permanente accertata, in percentuale',
  itt_giorni: 'Giorni di inabilità temporanea assoluta al 100%',
  importo_richiesto_cent: 'Quanto è stato chiesto, in euro',
  importo_offerto_cent: 'Quanto ha offerto la compagnia, in euro',
  importo_liquidato_cent: 'Quanto è stato effettivamente incassato, in euro',
  data_invio_negoziazione: 'Data di invio dell’invito a negoziazione assistita',
  dinamica: 'Come si è svolto il fatto, in breve',

  data_istanza: 'Data di deposito dell’istanza di ammissione',
  numero_rg_procedimento: 'R.G. del procedimento per cui è stato ammesso il patrocinio',
  data_decreto_liquidazione: 'Data del decreto con cui il giudice liquida il compenso',
  importo_liquidato: 'Importo liquidato dal decreto, in euro',
};

/**
 * Aiuto per i campi variabili dei modelli di atto, che cambiano da modello
 * a modello. Si riconoscono per parole contenute nel nome del segnaposto,
 * così funziona anche se il modello lo chiama in modo leggermente diverso.
 *
 * L'ordine conta: vince la prima corrispondenza, quindi le voci più
 * specifiche stanno prima.
 */
const AIUTO_SEGNAPOSTO: [string[], string][] = [
  [['codice', 'fiscale'], 'Codice fiscale completo, 16 caratteri'],
  [['partita', 'iva'], 'Partita IVA, 11 cifre'],
  [['avvocato'], 'Nome e cognome del difensore'],
  [['studio'], 'Via e numero civico, CAP e città dello studio'],
  [['assistito'], 'Nome e cognome completi dell’assistito'],
  [['cliente'], 'Nome e cognome completi dell’assistito'],
  [['controparte'], 'Nome della controparte o della compagnia'],
  [['tribunale'], 'Ufficio giudiziario adito, per esteso'],
  [['ruolo'], 'Numero di ruolo generale con l’anno'],
  [['rg'], 'Numero di ruolo generale con l’anno'],
  [['nato'], 'Luogo e data di nascita'],
  [['residen'], 'Indirizzo completo di residenza'],
  [['pec'], 'Indirizzo PEC per esteso'],
  [['sinistro'], 'Numero di sinistro assegnato dalla compagnia'],
  [['importo'], 'Importo in euro'],
  [['somma'], 'Importo in euro'],
];

/** Normalizza per confrontare nomi scritti in modi diversi. */
function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

/**
 * Suggerimento per un campo variabile di un modello, o null se il campo si
 * spiega da sé. Meglio nessuna didascalia che una didascalia inutile.
 */
export function aiutoSegnaposto(chiave: string, etichetta: string): string | null {
  const testo = `${normalizza(chiave)} ${normalizza(etichetta)}`;
  for (const [parole, aiuto] of AIUTO_SEGNAPOSTO) {
    if (parole.every((p) => testo.includes(p))) return aiuto;
  }
  return null;
}

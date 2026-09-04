/**
 * Link assistito al portale pubblico "Consultazione dei registri" del
 * Ministero della Giustizia (servizipst.giustizia.it).
 *
 * Il portale non ha un'API né una vera pagina di ricerca diretta: la
 * scelta di Regione/Ufficio/Registro è normalmente una cascata di select
 * JavaScript. Il modulo sfrutta però il fatto — verificato a mano — che
 * la stessa pagina di destinazione accetta gli stessi parametri anche
 * come query string in GET, così si arriva già pronti al modulo di
 * ricerca invece di dover rifare a mano i passaggi ogni volta.
 *
 * Quello che NON si può saltare è il CAPTCHA della ricerca per Ruolo
 * Generale: resta sempre da risolvere a mano nel portale, e va bene così
 * — è un controllo del Ministero, non un ostacolo tecnico da aggirare.
 *
 * I codici ufficio sono quelli restituiti dal portale stesso per la
 * Regione Sicilia (unica regione in cui opera lo studio): non sono
 * documentati altrove, li si è letti dalla tendina "Uffici giudiziari"
 * del portale.
 */

const BASE_HOME = 'https://servizipst.giustizia.it/PST/it/pst_2_6.wp';
const BASE_RICERCA = 'https://servizipst.giustizia.it/PST/it/pst_2_6_1.wp';
const REGIONE_SICILIA = '15';

const UFFICIO_PER_TRIBUNALE: Record<string, string> = {
  'Tribunale di Caltanissetta': '0850040098',
  'Tribunale di Catania': '0870150093',
  'Tribunale di Enna': '0860090099',
  'Tribunale di Agrigento': '0840010091',
  'Tribunale di Gela': '0850070094',
  'Tribunale di Siracusa': '0890170099',
  'Tribunale di Ragusa': '0880090091',
  'Tribunale di Messina': '0830480098',
  'Tribunale di Palermo': '0820530098',
  'Tribunale di Termini Imerese': '0820700094',
  'Tribunale di Marsala': '0810110099',
  'Tribunale di Trapani': '0810210090',
  'Tribunale di Sciacca': '0840410095',
  'Tribunale di Patti': '0830660096',
  'Tribunale di Barcellona P.G.': '0830050098',
  'Corte d’Appello di Caltanissetta': '0850040065',
  'Corte d’Appello di Catania': '0870150060',
  'Corte d’Appello di Palermo': '0820530065',
  'Corte d’Appello di Messina': '0830480065',
  'Giudice di Pace di Caltanissetta': '0850040156',
  'Giudice di Pace di Catania': '0870150151',
  'Giudice di Pace di Gela': '0850070152',
  'Giudice di Pace di Enna': '0860090157',
};

/** Il registro giusto dipende dalla materia: una causa di sinistro va in
 * Contenzioso Civile, un ricorso INPS in Lavoro. Dove la materia non lo
 * suggerisce con sufficiente certezza si preferisce ometterlo — lasciare
 * che l'avvocato lo scelga lui è meglio che indovinare male. */
const REGISTRO_PER_TIPO_PRATICA: Partial<Record<string, string>> = {
  sinistro: 'CC',
  causa_civile: 'CC',
  ricorso_inps: 'LAV',
  atp_invalidita: 'LAV',
  lavoro: 'LAV',
  sovraindebitamento: 'FALL',
};

export function linkGiustiziaCivile(params: {
  tribunale: string | null; tipoPratica: string | null;
  rgNumero: string | null; rgAnno: string | null;
}): string {
  const ufficio = params.tribunale ? UFFICIO_PER_TRIBUNALE[params.tribunale] : undefined;
  if (!ufficio) return BASE_HOME;

  const query = new URLSearchParams({ regioneRicerca: REGIONE_SICILIA, ufficioRicerca: ufficio });

  const registro = params.tipoPratica ? REGISTRO_PER_TIPO_PRATICA[params.tipoPratica] : undefined;
  if (!registro) return `${BASE_RICERCA}?${query.toString()}`;
  query.set('registroRicerca', registro);

  if (params.rgNumero) {
    query.set('searchType', 'numeroRuoloGen');
    query.set('numeroRuoloGen', params.rgNumero);
    if (params.rgAnno) query.set('annoRuoloGen', params.rgAnno);
  }
  return `${BASE_RICERCA}?${query.toString()}`;
}

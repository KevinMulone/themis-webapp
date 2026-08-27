import 'server-only';
import { simpleParser } from 'mailparser';
import { XMLParser } from 'fast-xml-parser';

/**
 * Interpretazione di un messaggio scaricato da una casella PEC.
 *
 * Il filtro tra "messaggio vero" e "ricevuta" non è euristico: è scritto
 * nella norma tecnica della PEC (DM 2 novembre 2005, allegato tecnico).
 * Ogni messaggio generato dal sistema di posta certificata allega un file
 * "daticert.xml" la cui radice <postacert tipo="..."> vale esattamente uno
 * di questi valori. Solo "posta-certificata" è un messaggio ricevuto vero;
 * tutti gli altri sono ricevute (accettazione, consegna, errori, virus).
 *
 * Se un messaggio non ha daticert.xml (non proviene dal sistema PEC, es.
 * una PEC ricevuta da una casella di posta ordinaria) viene classificato
 * "sconosciuto" e trattato come messaggio vero, per non perdere nulla.
 */
export const TIPI_PEC = [
  'posta-certificata',
  'accettazione',
  'non-accettazione',
  'presa-in-carico',
  'avvenuta-consegna',
  'errore-consegna',
  'preavviso-errore-consegna',
  'rilevazione-virus',
  'sconosciuto',
] as const;

export type TipoPec = (typeof TIPI_PEC)[number];

export type MessaggioPecInterpretato = {
  tipoPec: TipoPec;
  mittente: string | null;
  destinatari: string | null;
  oggetto: string | null;
  dataInvio: Date | null;
  /** Testo utile a occhio umano (corpo del messaggio originale, se presente). */
  corpoTesto: string | null;
  /** true se è stato trovato e interpretato un daticert.xml valido. */
  daticertValido: boolean;
};

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function pulisciIndirizzi(valore: unknown): string | null {
  if (!valore || typeof valore !== 'object') return null;
  const v = valore as { text?: string };
  return v.text || null;
}

/**
 * Interpreta il messaggio grezzo (RFC 822, così come scaricato via IMAP).
 *
 * Per i messaggi con tipo "posta-certificata" il vero contenuto (mittente,
 * oggetto, corpo) è quello del messaggio ORIGINALE, allegato come
 * "postacert.eml" — non quello della busta di trasporto (che ha come
 * mittente l'indirizzo del gestore PEC). Per le ricevute invece la busta
 * stessa è il messaggio.
 */
export async function interpretaMessaggioPec(sorgente: Buffer): Promise<MessaggioPecInterpretato> {
  const busta = await simpleParser(sorgente);

  const daticertAttachment = busta.attachments.find((a) => a.filename === 'daticert.xml');
  const postacertAttachment = busta.attachments.find((a) => a.filename === 'postacert.eml');

  if (!daticertAttachment) {
    return {
      tipoPec: 'sconosciuto',
      mittente: pulisciIndirizzi(busta.from),
      destinatari: pulisciIndirizzi(busta.to),
      oggetto: busta.subject || null,
      dataInvio: busta.date || null,
      corpoTesto: busta.text || null,
      daticertValido: false,
    };
  }

  let tipoPec: TipoPec = 'sconosciuto';
  try {
    const xml = xmlParser.parse(daticertAttachment.content.toString('utf-8'));
    const tipoGrezzo = xml?.postacert?.['@_tipo'];
    if (typeof tipoGrezzo === 'string' && (TIPI_PEC as readonly string[]).includes(tipoGrezzo)) {
      tipoPec = tipoGrezzo as TipoPec;
    }
  } catch {
    // daticert.xml malformato: resta "sconosciuto", non blocca la sincronizzazione.
  }

  // Solo i messaggi veri hanno un postacert.eml da riaprire per il contenuto reale.
  if (tipoPec === 'posta-certificata' && postacertAttachment) {
    const originale = await simpleParser(postacertAttachment.content);
    return {
      tipoPec,
      mittente: pulisciIndirizzi(originale.from),
      destinatari: pulisciIndirizzi(originale.to),
      oggetto: originale.subject || null,
      dataInvio: originale.date || null,
      corpoTesto: originale.text || null,
      daticertValido: true,
    };
  }

  // Ricevute: il contenuto utile è quello della busta stessa.
  return {
    tipoPec,
    mittente: pulisciIndirizzi(busta.from),
    destinatari: pulisciIndirizzi(busta.to),
    oggetto: busta.subject || null,
    dataInvio: busta.date || null,
    corpoTesto: busta.text || null,
    daticertValido: true,
  };
}

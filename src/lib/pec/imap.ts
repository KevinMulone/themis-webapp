import 'server-only';
import { ImapFlow } from 'imapflow';

export { MAX_MESSAGGI_PER_GIRO } from './costanti';
import { MAX_MESSAGGI_PER_GIRO } from './costanti';

export type ConfigurazioneImap = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export type MessaggioGrezzo = {
  uid: number;
  sorgente: Buffer;
};

export type EsitoSincronizzazione = {
  uidValidity: bigint;
  /** UID più alto tra quelli restituiti in questo giro (da salvare come nuovo segnalibro). */
  ultimoUidVisto: number | null;
  messaggi: MessaggioGrezzo[];
};

/**
 * Scarica i messaggi nuovi di una casella IMAP a partire dal segnalibro
 * salvato (`daUidEsclusivo`: si scaricano solo UID strettamente maggiori).
 *
 * Gli UID IMAP sono stabili solo finché non cambia UIDVALIDITY della
 * cartella. Se `uidValiditySalvato` è indicato e non coincide con quello
 * corrente della cartella, il segnalibro precedente non è più affidabile e
 * si riparte da zero su questa cartella (altrimenti si rischia di saltare
 * messaggi in silenzio). Il nuovo UIDVALIDITY va comunque salvato dal
 * chiamante, coincida o no con quello precedente.
 */
export async function scaricaNuoviMessaggi(
  config: ConfigurazioneImap,
  daUidEsclusivo: number,
  uidValiditySalvato: bigint | null,
): Promise<EsitoSincronizzazione> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uidValidity = client.mailbox && typeof client.mailbox !== 'boolean' ? client.mailbox.uidValidity : BigInt(0);
      const uidValidityCambiato = uidValiditySalvato !== null && uidValiditySalvato !== uidValidity;
      const daUidEffettivo = uidValidityCambiato ? 0 : daUidEsclusivo;
      const messaggi: MessaggioGrezzo[] = [];
      let ultimoUidVisto: number | null = null;

      const range = `${daUidEffettivo + 1}:*`;
      for await (const messaggio of client.fetch(range, { uid: true, source: true }, { uid: true })) {
        // Con range aperto ("N:*") un server IMAP può restituire l'ultimo
        // messaggio esistente anche se il suo UID è <= daUidEffettivo,
        // quando non ce ne sono di più recenti: va scartato esplicitamente.
        if (messaggio.uid <= daUidEffettivo || !messaggio.source) continue;
        messaggi.push({ uid: messaggio.uid, sorgente: messaggio.source });
        if (ultimoUidVisto === null || messaggio.uid > ultimoUidVisto) ultimoUidVisto = messaggio.uid;
        if (messaggi.length >= MAX_MESSAGGI_PER_GIRO) break;
      }

      messaggi.sort((a, b) => a.uid - b.uid);
      return { uidValidity, ultimoUidVisto, messaggi };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export type CartellaImap = { percorso: string; nome: string; messaggi: number };

/**
 * Elenca le cartelle della casella con quanti messaggi contengono.
 *
 * Serve a rispondere a una domanda che altrimenti si risolve a
 * indovinelli: «non le scarica tutte» può voler dire che mancano le
 * inviate, che mancano quelle in archivio, o che il segnalibro si è
 * fermato. Con i numeri del server accanto ai nostri, si vede quale.
 */
export async function elencaCartelle(config: ConfigurazioneImap): Promise<CartellaImap[]> {
  const client = new ImapFlow({
    host: config.host, port: config.port, secure: true,
    auth: { user: config.user, pass: config.password }, logger: false,
  });
  await client.connect();
  try {
    const cartelle: CartellaImap[] = [];
    for (const casella of await client.list()) {
      if (casella.flags?.has('\\Noselect')) continue;
      try {
        const stato = await client.status(casella.path, { messages: true });
        cartelle.push({
          percorso: casella.path,
          nome: casella.name || casella.path,
          messaggi: stato.messages ?? 0,
        });
      } catch {
        // Una cartella che non si lascia interrogare non deve far fallire
        // l'elenco: si segna con -1 e si prosegue.
        cartelle.push({ percorso: casella.path, nome: casella.name || casella.path, messaggi: -1 });
      }
    }
    return cartelle;
  } finally {
    await client.logout();
  }
}

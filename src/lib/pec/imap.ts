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

export type EsitoScarico = {
  uidValidity: bigint;
  /** true se UIDVALIDITY è cambiato e i segnalibri sono stati azzerati. */
  azzerato: boolean;
  messaggi: MessaggioGrezzo[];
  uidMassimoPreso: number | null;
  uidMinimoPreso: number | null;
  restanti: number;
};

/**
 * Scarica messaggi da una cartella, dal capo giusto.
 *
 * `modo: 'nuovi'` prende i più recenti non ancora presi: è quello che
 * serve quasi sempre, perché una PEC arrivata stamattina vale più di una
 * di tre anni fa. `modo: 'arretrato'` scende invece nel passato, a
 * ritroso, e serve solo a chi vuole ricostruire lo storico.
 *
 * Gli UID sono stabili finché non cambia UIDVALIDITY della cartella: se
 * cambia, i segnalibri non valgono più e si riparte, altrimenti si
 * salterebbero messaggi in silenzio.
 */
export async function scaricaMessaggi(
  config: ConfigurazioneImap,
  cartella: string,
  opzioni: {
    modo: 'nuovi' | 'arretrato';
    lastSeenUid: number;
    arretratoFinoA: number | null;
    uidValiditySalvato: bigint | null;
    massimo: number;
  },
): Promise<EsitoScarico> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock(cartella);
    try {
      const uidValidity = client.mailbox && typeof client.mailbox !== 'boolean'
        ? client.mailbox.uidValidity : BigInt(0);
      const azzera = opzioni.uidValiditySalvato !== null
        && opzioni.uidValiditySalvato !== uidValidity;

      const lastSeen = azzera ? 0 : opzioni.lastSeenUid;
      const finoA = azzera ? null : opzioni.arretratoFinoA;

      // L'elenco degli UID presenti: sono solo numeri, e averli tutti
      // evita di indovinare dove comincia e dove finisce la cartella.
      const tutti = (await client.search({ all: true }, { uid: true })) || [];
      const ordinati = [...tutti].sort((a, b) => a - b);

      const candidati = opzioni.modo === 'nuovi'
        // I più recenti fra quelli mai presi, dal più recente in giù.
        ? ordinati.filter((u) => u > lastSeen).slice(-opzioni.massimo)
        // Il passato, dal più recente dei vecchi in giù.
        : ordinati.filter((u) => finoA === null || u < finoA).slice(-opzioni.massimo);

      const messaggi: MessaggioGrezzo[] = [];
      if (candidati.length > 0) {
        for await (const messaggio of client.fetch(
          candidati.join(','), { uid: true, source: true }, { uid: true },
        )) {
          if (!messaggio.source) continue;
          messaggi.push({ uid: messaggio.uid, sorgente: messaggio.source });
        }
      }
      messaggi.sort((a, b) => a.uid - b.uid);

      const uidPresi = messaggi.map((m) => m.uid);
      return {
        uidValidity,
        azzerato: azzera,
        messaggi,
        uidMassimoPreso: uidPresi.length ? Math.max(...uidPresi) : null,
        uidMinimoPreso: uidPresi.length ? Math.min(...uidPresi) : null,
        // Quanti ne restano dietro: serve all'interfaccia per dire se c'è
        // ancora arretrato da recuperare.
        restanti: opzioni.modo === 'nuovi'
          ? Math.max(0, ordinati.filter((u) => u > lastSeen).length - messaggi.length)
          : Math.max(0, ordinati.filter((u) => finoA === null || u < finoA).length - messaggi.length),
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export type RuoloCartella = 'inbox' | 'inviata' | 'archivio' | 'altro';
export type CartellaImap = {
  percorso: string; nome: string; messaggi: number; ruolo: RuoloCartella;
};

/**
 * A cosa serve una cartella.
 *
 * Si guarda prima l'attributo dichiarato dal server (`\\Sent`, `\\Archive`):
 * è la fonte affidabile. Solo se manca si ricade sul nome, che cambia da
 * gestore a gestore e da lingua a lingua — «Posta inviata», «Sent»,
 * «Inviata».
 */
function ruoloDiCartella(percorso: string, attributi: Set<string> | undefined): RuoloCartella {
  const flag = (f: string) => attributi?.has(f) ?? false;
  if (percorso.toUpperCase() === 'INBOX') return 'inbox';
  if (flag('\\Sent')) return 'inviata';
  if (flag('\\Archive') || flag('\\All')) return 'archivio';

  const n = percorso.toLowerCase();
  if (n.includes('inviat') || n.includes('sent')) return 'inviata';
  if (n.includes('archiv')) return 'archivio';
  return 'altro';
}

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
          ruolo: ruoloDiCartella(casella.path, casella.flags),
        });
      } catch {
        // Una cartella che non si lascia interrogare non deve far fallire
        // l'elenco: si segna con -1 e si prosegue.
        cartelle.push({
          percorso: casella.path, nome: casella.name || casella.path, messaggi: -1,
          ruolo: ruoloDiCartella(casella.path, casella.flags),
        });
      }
    }
    return cartelle;
  } finally {
    await client.logout();
  }
}

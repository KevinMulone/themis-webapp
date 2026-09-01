import 'server-only';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { ImapFlow } from 'imapflow';

export type Allegato = { nome: string; contenuto: Buffer; tipo?: string };

export type DaInviare = {
  mittente: string;
  destinatari: string[];
  cc?: string[];
  oggetto: string;
  testo: string;
  allegati?: Allegato[];
};

export type ConfigurazioneInvio = {
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  user: string;
  password: string;
};

/**
 * Invia una PEC e ne deposita copia nella cartella delle inviate.
 *
 * Il deposito non è un vezzo: molti gestori non archiviano da soli quello
 * che parte via SMTP, e senza questo passaggio la PEC inviata non
 * comparirebbe né nella webmail né in Themis — resterebbe solo
 * l'attestazione di accettazione, che dice che è partito qualcosa ma non
 * che cosa.
 *
 * Se il deposito fallisce non si solleva un errore: il messaggio è già
 * partito, ed è un fatto giuridico compiuto. Dire "invio fallito" quando
 * la PEC è nelle mani del gestore sarebbe la bugia peggiore che questo
 * codice possa raccontare.
 */
export async function inviaPec(
  config: ConfigurazioneInvio,
  messaggio: DaInviare,
): Promise<{ messageId: string; depositata: boolean; avviso?: string }> {
  const trasporto = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    // 465 è SMTPS: TLS dal primo byte. Le altre porte negoziano con STARTTLS.
    secure: config.smtpPort === 465,
    auth: { user: config.user, pass: config.password },
  });

  // Il messaggio si compone prima e si invia poi, invece di lasciarlo fare
  // a sendMail: così lo stesso identico byte per byte che parte è quello
  // che si deposita nelle inviate. Farlo comporre due volte darebbe due
  // messaggi diversi, con due Message-ID diversi.
  const composer = new MailComposer({
    from: messaggio.mittente,
    to: messaggio.destinatari,
    cc: messaggio.cc?.length ? messaggio.cc : undefined,
    subject: messaggio.oggetto,
    text: messaggio.testo,
    attachments: messaggio.allegati?.map((a) => ({
      filename: a.nome, content: a.contenuto, contentType: a.tipo,
    })),
  });
  const grezzo: Buffer = await composer.compile().build();

  const esito = await trasporto.sendMail({
    raw: grezzo,
    envelope: {
      from: messaggio.mittente,
      to: [...messaggio.destinatari, ...(messaggio.cc ?? [])],
    },
  });

  let depositata = false;
  let avviso: string | undefined;
  try {
    const client = new ImapFlow({
      host: config.imapHost, port: config.imapPort, secure: true,
      auth: { user: config.user, pass: config.password }, logger: false,
    });
    await client.connect();
    try {
      // Il nome della cartella cambia da gestore a gestore: si prende
      // quella dichiarata come "inviata", e solo in mancanza si tenta con
      // i nomi consueti.
      const cartelle = await client.list();
      const inviate = cartelle.find((c) => c.flags?.has('\\Sent'))
        ?? cartelle.find((c) => /sent|inviat/i.test(c.path));
      if (inviate) {
        await client.append(inviate.path, grezzo, ['\\Seen']);
        depositata = true;
      } else {
        avviso = 'Inviata, ma non ho trovato la cartella delle inviate dove depositarne copia.';
      }
    } finally {
      await client.logout();
    }
  } catch (errore) {
    avviso = 'Inviata. La copia nella cartella delle inviate non è riuscita: '
      + (errore instanceof Error ? errore.message : 'errore sconosciuto');
  }

  return { messageId: esito.messageId, depositata, avviso };
}

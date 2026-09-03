/**
 * Un socket WhatsApp per studio, tenuto aperto in questo processo.
 *
 * Baileys imita il protocollo WhatsApp Web multi-dispositivo (non l'API
 * ufficiale): per questo la libreria è pinnata a una versione ESATTA nel
 * package.json (non "^"), e per lo stesso motivo va aggiornata a mano,
 * dopo aver controllato le segnalazioni sul suo repository — WhatsApp può
 * cambiare il protocollo senza preavviso, e un aggiornamento automatico
 * potrebbe sostituire "funziona" con "non funziona più" senza che nessuno
 * lo scelga.
 *
 * Le credenziali di sessione (le chiavi del protocollo Signal, che
 * ruotano di continuo) restano SOLO sul disco di questo servizio, in una
 * cartella per studio: Themis non le vede né le riceve mai.
 */

import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Boom } from '@hapi/boom';
import { pino } from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
} from '@whiskeysockets/baileys';

export type StatoStudio = 'disconnesso' | 'in_attesa_qr' | 'connesso';

type Sessione = {
  socket: WASocket | null;
  stato: StatoStudio;
  numero: string | null;
  qrDataUrl: string | null;
  avviando: boolean;
};

const DATA_DIR = process.env.DATA_DIR || './dati';
const LOG = pino({ level: process.env.LOG_LEVEL || 'silent' });

const sessioni = new Map<string, Sessione>();

function cartellaStudio(studioId: string): string {
  return path.join(DATA_DIR, studioId);
}

function sessione(studioId: string): Sessione {
  if (!sessioni.has(studioId)) {
    sessioni.set(studioId, { socket: null, stato: 'disconnesso', numero: null, qrDataUrl: null, avviando: false });
  }
  return sessioni.get(studioId)!;
}

/** Manda un messaggio ricevuto a Themis, con qualche tentativo: Vercel
 *  potrebbe essere a freddo proprio nel momento in cui arriva. */
async function inviaAlWebhook(payload: Record<string, unknown>): Promise<void> {
  const configurato = process.env.VERCEL_WEBHOOK_URL;
  const segreto = process.env.WHATSAPP_WORKER_SECRET;
  if (!configurato || !segreto) {
    console.error('VERCEL_WEBHOOK_URL o WHATSAPP_WORKER_SECRET non configurati: messaggio perso.');
    return;
  }
  // Un errore facile da fare incollando l'indirizzo: se manca lo schema,
  // fetch() fallisce con un messaggio poco chiaro. Meglio presumere https.
  const url = /^https?:\/\//.test(configurato) ? configurato : `https://${configurato}`;
  console.log(`Chiamo il webhook: ${url}`);
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segreto}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) { console.log('Consegnato a Themis con successo.'); return; }
      console.error(`Webhook Themis rifiutato (tentativo ${tentativo}/3): ${res.status} — ${await res.text().catch(() => '')}`);
    } catch (errore) {
      console.error(`Webhook Themis non raggiungibile (tentativo ${tentativo}/3):`, errore);
    }
    await new Promise((r) => setTimeout(r, tentativo * 2000));
  }
  console.error('Messaggio non consegnato a Themis dopo 3 tentativi:', payload);
}

/** Manda a Themis un cambio di stato di un messaggio già spedito (1
 *  spunta -> 2 grigie -> 2 blu). Stesso schema di inviaAlWebhook, ma su
 *  un indirizzo diverso: sono due notizie di natura diversa, non ha senso
 *  farle finire nella stessa forma. */
async function inviaStatoAlWebhook(payload: Record<string, unknown>): Promise<void> {
  const configurato = process.env.VERCEL_WEBHOOK_URL;
  const segreto = process.env.WHATSAPP_WORKER_SECRET;
  if (!configurato || !segreto) return;
  const base = /^https?:\/\//.test(configurato) ? configurato : `https://${configurato}`;
  const url = base.replace(/\/webhook\/?$/, '/webhook-stato');
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segreto}` },
      body: JSON.stringify(payload),
    });
  } catch (errore) {
    console.error('Aggiornamento di stato non consegnato a Themis:', errore);
  }
}

/** Il testo di un messaggio Baileys, dove c'è — niente immagini, audio o
 *  documenti in questa prima versione: solo il testo. */
function testoMessaggio(m: { message?: unknown }): string {
  const msg = m.message as { conversation?: string; extendedTextMessage?: { text?: string } } | undefined;
  return msg?.conversation || msg?.extendedTextMessage?.text || '';
}

export async function avviaSessione(studioId: string): Promise<Sessione> {
  const s = sessione(studioId);
  if (s.socket || s.avviando) return s;
  s.avviando = true;

  mkdirSync(cartellaStudio(studioId), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(cartellaStudio(studioId));

  // Senza syncFullHistory, WhatsApp manda solo una cronologia ridotta (o
  // niente): senza questa opzione l'evento messaging-history.set non
  // arriva affatto in un nuovo accoppiamento.
  const socket = makeWASocket({ auth: state, logger: LOG as never, syncFullHistory: true });
  s.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      QRCode.toDataURL(qr)
        .then((dataUrl) => { s.qrDataUrl = dataUrl; s.stato = 'in_attesa_qr'; })
        .catch((e) => console.error('Generazione QR non riuscita:', e));
    }

    if (connection === 'open') {
      s.stato = 'connesso';
      s.qrDataUrl = null;
      s.avviando = false;
      // Il JID dell'account collegato è "<numero>:<device>@s.whatsapp.net".
      s.numero = socket.user?.id?.split(':')[0]?.split('@')[0] ?? null;
      console.log(`[${studioId}] connesso al numero ${s.numero}`);
    }

    if (connection === 'close') {
      s.socket = null;
      s.avviando = false;
      const codice = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const disconnessioneDefinitiva = codice === DisconnectReason.loggedOut;
      console.log(`[${studioId}] connessione chiusa (codice ${codice ?? '?'}, definitiva: ${disconnessioneDefinitiva})`);

      if (disconnessioneDefinitiva) {
        // Sessione revocata dal telefono, o mai davvero completata: le
        // credenziali locali non servono più, si riparte da un QR nuovo.
        s.stato = 'disconnesso';
        s.numero = null;
        s.qrDataUrl = null;
        rmSync(cartellaStudio(studioId), { recursive: true, force: true });
      } else {
        // Caduta di rete o riavvio: la sessione resta valida, si riprova
        // da sola invece di lasciare lo studio scollegato in silenzio.
        s.stato = 'disconnesso';
        setTimeout(() => { avviaSessione(studioId).catch((e) => console.error('Riconnessione non riuscita:', e)); }, 3000);
      }
    }
  });

  socket.ev.on('messages.upsert', ({ messages, type }) => {
    console.log(`[${studioId}] messages.upsert: tipo=${type}, quanti=${messages.length}`);
    if (type !== 'notify') return;
    for (const m of messages) {
      console.log(`[${studioId}]   messaggio: da=${m.key.remoteJid} fromMe=${m.key.fromMe} `
        + `haTesto=${!!testoMessaggio(m)}`);
      // Niente messaggi mandati da noi stessi (arrivano già registrati da
      // /invia), niente gruppi: in v1 legge solo la chat diretta col
      // cliente.
      if (m.key.fromMe || !m.key.remoteJid || m.key.remoteJid.endsWith('@g.us')) continue;
      const testo = testoMessaggio(m);
      if (!testo.trim()) continue;
      console.log(`[${studioId}]   inoltro a Themis: "${testo.slice(0, 40)}"`);
      inviaAlWebhook({
        studioId,
        from: m.key.remoteJid,
        text: testo,
        waMessageId: m.key.id,
        // Il nome con cui il mittente si è presentato su WhatsApp — non è
        // detto corrisponda al nome vero, ma è meglio del solo numero
        // finché il messaggio non è collegato a un cliente.
        pushName: m.pushName || null,
        timestampMs: m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now(),
      }).catch((e) => console.error('Invio al webhook fallito:', e));
    }
  });

  // 1 spunta (mandato) -> 2 grigie (consegnato) -> 2 blu (letto). Solo per
  // i messaggi mandati da qui: di quelli ricevuti non ha senso parlare di
  // "letto", li ha già letti chi guarda Themis.
  socket.ev.on('messages.update', (aggiornamenti) => {
    for (const u of aggiornamenti) {
      if (!u.key.fromMe || !u.key.id || u.update.status === undefined) continue;
      inviaStatoAlWebhook({ studioId, waMessageId: u.key.id, status: u.update.status })
        .catch((e) => console.error('Aggiornamento stato non inoltrato:', e));
    }
  });

  // La cronologia che WhatsApp condivide al primo collegamento (quanta ne
  // manda dipende dal telefono, non è controllabile da qui). Si importa
  // solo l'essenziale: chat dirette, solo testo, solo gli ultimi 30 giorni
  // e un tetto massimo — non è pensata per ricostruire l'intero archivio,
  // solo per non ripartire da una casella vuota.
  const LIMITE_GIORNI_STORICO = 30;
  const MASSIMO_STORICO = 300;
  let storicoGiaImportato = false;
  socket.ev.on('messaging-history.set', ({ messages, contacts }) => {
    if (storicoGiaImportato) return; // una volta sola per connessione
    storicoGiaImportato = true;

    const nomi = new Map<string, string>();
    for (const c of contacts) {
      const nome = c.name || c.notify || c.verifiedName;
      if (c.id && nome) nomi.set(c.id, nome);
    }

    const sogliaMs = Date.now() - LIMITE_GIORNI_STORICO * 24 * 60 * 60 * 1000;
    const candidati = messages
      .filter((m) => m.key.remoteJid && !m.key.remoteJid.endsWith('@g.us') && testoMessaggio(m).trim())
      .filter((m) => !m.messageTimestamp || Number(m.messageTimestamp) * 1000 >= sogliaMs)
      .sort((a, b) => Number(a.messageTimestamp ?? 0) - Number(b.messageTimestamp ?? 0))
      .slice(-MASSIMO_STORICO);

    console.log(`[${studioId}] cronologia ricevuta: ${messages.length} messaggi, ${candidati.length} da importare`);

    (async () => {
      for (const m of candidati) {
        await inviaAlWebhook({
          studioId,
          from: m.key.remoteJid,
          text: testoMessaggio(m),
          waMessageId: m.key.id,
          pushName: (m.key.fromMe ? null : m.pushName) || nomi.get(m.key.remoteJid!) || null,
          direzione: m.key.fromMe ? 'out' : 'in',
          timestampMs: m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now(),
        }).catch((e) => console.error('Messaggio storico non importato:', e));
        // Un giro alla volta, non tutti insieme: altrimenti centinaia di
        // richieste in parallelo travolgerebbero Themis nello stesso istante.
        await new Promise((r) => setTimeout(r, 150));
      }
      console.log(`[${studioId}] importazione cronologia completata`);
    })().catch((e) => console.error('Importazione cronologia interrotta:', e));
  });

  return s;
}

export function statoSessione(studioId: string): { stato: StatoStudio; numero: string | null; qr: string | null } {
  const s = sessione(studioId);
  return { stato: s.stato, numero: s.numero, qr: s.qrDataUrl };
}

export async function disconnetti(studioId: string): Promise<void> {
  const s = sessione(studioId);
  try { await s.socket?.logout(); } catch { /* si azzera comunque lo stato locale */ }
  s.socket = null;
  s.stato = 'disconnesso';
  s.numero = null;
  s.qrDataUrl = null;
  rmSync(cartellaStudio(studioId), { recursive: true, force: true });
  sessioni.delete(studioId);
}

/** Torna l'id vero che WhatsApp assegna al messaggio spedito — serve a
 *  Themis per riconoscere, più avanti, gli aggiornamenti di stato
 *  (consegnato, letto) che arrivano riferiti a quello stesso id. */
export async function invia(studioId: string, a: string, testo: string): Promise<string> {
  const s = sessione(studioId);
  if (!s.socket || s.stato !== 'connesso') throw new Error('Il numero di questo studio non è connesso');
  const jid = a.includes('@') ? a : `${a}@s.whatsapp.net`;
  const risultato = await s.socket.sendMessage(jid, { text: testo });
  return risultato?.key?.id ?? '';
}

/** Al riavvio del processo, riapre da sole le sessioni che avevano già
 *  una cartella di credenziali salvata — altrimenti ogni riavvio del
 *  worker (un deploy, un crash) scollegherebbe tutti gli studi. */
/** Solo un uuid (studioId vero) può essere una cartella di sessione: un
 *  volume vuoto contiene già da sé cartelle come "lost+found" create dal
 *  filesystem, che non sono sessioni di nessuno studio. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ripristinaSessioniEsistenti(): void {
  if (!existsSync(DATA_DIR)) return;
  const trovate = readdirSync(DATA_DIR).filter((nome) => UUID.test(nome));
  console.log(`Sessioni da ripristinare: ${trovate.length ? trovate.join(', ') : 'nessuna'}`);
  for (const studioId of trovate) {
    avviaSessione(studioId).catch((e) => console.error('Sessione non ripristinata per lo studio', studioId, e));
  }
}

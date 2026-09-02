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
  const url = process.env.VERCEL_WEBHOOK_URL;
  const segreto = process.env.WHATSAPP_WORKER_SECRET;
  if (!url || !segreto) {
    console.error('VERCEL_WEBHOOK_URL o WHATSAPP_WORKER_SECRET non configurati: messaggio perso.');
    return;
  }
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segreto}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
      console.error(`Webhook Themis rifiutato (tentativo ${tentativo}/3): ${res.status}`);
    } catch (errore) {
      console.error(`Webhook Themis non raggiungibile (tentativo ${tentativo}/3):`, errore);
    }
    await new Promise((r) => setTimeout(r, tentativo * 2000));
  }
  console.error('Messaggio non consegnato a Themis dopo 3 tentativi:', payload);
}

export async function avviaSessione(studioId: string): Promise<Sessione> {
  const s = sessione(studioId);
  if (s.socket || s.avviando) return s;
  s.avviando = true;

  mkdirSync(cartellaStudio(studioId), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(cartellaStudio(studioId));

  const socket = makeWASocket({ auth: state, logger: LOG as never });
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
    }

    if (connection === 'close') {
      s.socket = null;
      s.avviando = false;
      const codice = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const disconnessioneDefinitiva = codice === DisconnectReason.loggedOut;

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
    if (type !== 'notify') return;
    for (const m of messages) {
      // Niente messaggi mandati da noi stessi, niente gruppi: in v1 legge
      // solo la chat diretta col cliente.
      if (m.key.fromMe || !m.key.remoteJid || m.key.remoteJid.endsWith('@g.us')) continue;
      const testo = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
      if (!testo.trim()) continue;
      inviaAlWebhook({
        studioId,
        from: m.key.remoteJid,
        text: testo,
        waMessageId: m.key.id,
        timestampMs: m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now(),
      }).catch((e) => console.error('Invio al webhook fallito:', e));
    }
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

export async function invia(studioId: string, a: string, testo: string): Promise<void> {
  const s = sessione(studioId);
  if (!s.socket || s.stato !== 'connesso') throw new Error('Il numero di questo studio non è connesso');
  const jid = a.includes('@') ? a : `${a}@s.whatsapp.net`;
  await s.socket.sendMessage(jid, { text: testo });
}

/** Al riavvio del processo, riapre da sole le sessioni che avevano già
 *  una cartella di credenziali salvata — altrimenti ogni riavvio del
 *  worker (un deploy, un crash) scollegherebbe tutti gli studi. */
export function ripristinaSessioniEsistenti(): void {
  if (!existsSync(DATA_DIR)) return;
  for (const studioId of readdirSync(DATA_DIR)) {
    avviaSessione(studioId).catch((e) => console.error('Sessione non ripristinata per lo studio', studioId, e));
  }
}

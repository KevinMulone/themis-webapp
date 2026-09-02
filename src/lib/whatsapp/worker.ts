import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Il ponte verso il servizio WhatsApp esterno.
 *
 * Il servizio (cartella `whatsapp-worker/` nel repository, ma un
 * progetto a sé, ospitato fuori da Vercel) tiene aperta la connessione
 * con WhatsApp — cosa che una funzione serverless non può fare — e parla
 * con Themis solo via queste chiamate HTTP autenticate col segreto
 * condiviso. Il browser non chiama mai direttamente il worker: ogni
 * azione passa da una route di questa app, che verifica prima chi sta
 * chiedendo.
 */

function urlBase(): string {
  const url = process.env.WHATSAPP_WORKER_URL;
  if (!url) throw new Error('WHATSAPP_WORKER_URL non configurata');
  // Un errore facile da fare quando si incolla il dominio da Railway: se
  // manca lo schema, fetch() fallisce con un errore poco chiaro
  // ("Failed to parse URL"). Meglio presumere https e proseguire.
  const conSchema = /^https?:\/\//.test(url) ? url : `https://${url}`;
  return conSchema.replace(/\/$/, '');
}

function segreto(): string {
  const s = process.env.WHATSAPP_WORKER_SECRET;
  if (!s) throw new Error('WHATSAPP_WORKER_SECRET non configurata');
  return s;
}

export function whatsappConfigurato(): boolean {
  return !!process.env.WHATSAPP_WORKER_URL && !!process.env.WHATSAPP_WORKER_SECRET;
}

async function chiamaWorker<T>(percorso: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${urlBase()}${percorso}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${segreto()}`, 'Content-Type': 'application/json' },
    // Il worker può essere temporaneamente irraggiungibile (riavvio,
    // deploy): un timeout esplicito evita che una route di Themis resti
    // appesa in attesa di un servizio caduto.
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Il servizio WhatsApp ha risposto ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type StatoWhatsapp = { stato: 'disconnesso' | 'in_attesa_qr' | 'connesso'; numero?: string };

/** Avvia (o ritrova, se già in corso) l'accoppiamento per questo studio. */
export async function connettiWorker(studioId: string): Promise<{ qr: string | null } & StatoWhatsapp> {
  return chiamaWorker(`/studi/${studioId}/connetti`, { method: 'POST' });
}

export async function statoWorker(studioId: string): Promise<StatoWhatsapp> {
  return chiamaWorker(`/studi/${studioId}/stato`);
}

export async function disconnettiWorker(studioId: string): Promise<void> {
  await chiamaWorker(`/studi/${studioId}/disconnetti`, { method: 'POST' });
}

/** Invia un messaggio dal numero collegato a quello studio. `a` è il
 *  numero destinatario in formato internazionale (senza "+"). */
export async function inviaWorker(studioId: string, a: string, testo: string): Promise<void> {
  await chiamaWorker(`/studi/${studioId}/invia`, {
    method: 'POST',
    body: JSON.stringify({ a, testo }),
  });
}

/**
 * Riporta nel database lo stato appena letto dal worker, così le altre
 * pagine (che non devono chiamare un servizio esterno solo per mostrare
 * un pallino verde) leggono l'ultimo stato noto con una query normale.
 *
 * `connesso_il` si imposta solo al MOMENTO in cui si scopre la
 * connessione, non a ogni poll: altrimenti "connesso da" continuerebbe
 * ad avanzare come se ci si fosse appena collegati.
 */
export async function aggiornaAccountLocale(studioId: string, risposta: StatoWhatsapp): Promise<void> {
  const admin = createAdminClient();
  const { data: attuale } = await admin
    .from('whatsapp_account').select('stato_connessione, connesso_il')
    .eq('studio_id', studioId).maybeSingle();

  const connessoIl = risposta.stato !== 'connesso'
    ? null
    : attuale?.stato_connessione === 'connesso' ? attuale.connesso_il : new Date().toISOString();

  await admin.from('whatsapp_account').upsert({
    studio_id: studioId,
    stato_connessione: risposta.stato,
    numero_telefono: risposta.numero ?? null,
    connesso_il: connessoIl,
    aggiornato_il: new Date().toISOString(),
  }, { onConflict: 'studio_id' });
}

/**
 * Il servizio HTTP che Themis chiama per collegare, controllare e usare
 * WhatsApp. Non lo chiama mai il browser: solo le route server di Themis,
 * col segreto condiviso (WHATSAPP_WORKER_SECRET) nell'intestazione
 * Authorization — stesso schema già in uso per il cron delle PEC.
 */

import express from 'express';
import {
  avviaSessione, statoSessione, disconnetti, invia, ripristinaSessioniEsistenti,
} from './baileys.js';

const app = express();
app.use(express.json());

function autenticato(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const segreto = process.env.WHATSAPP_WORKER_SECRET;
  if (!segreto || req.headers.authorization !== `Bearer ${segreto}`) {
    res.status(401).json({ error: 'Non autorizzato' });
    return;
  }
  next();
}

app.use(autenticato);

/**
 * Avvia (o ritrova) l'accoppiamento. Aspetta fino a 6 secondi che compaia
 * un QR o che risulti già connesso, prima di rispondere: senza
 * quest'attesa Themis dovrebbe fare subito un secondo giro per ottenere
 * il QR, che nella grande maggioranza dei casi è già pronto un attimo
 * dopo l'avvio del socket.
 */
app.post('/studi/:studioId/connetti', async (req, res) => {
  const { studioId } = req.params;
  try {
    await avviaSessione(studioId);
    const scadenza = Date.now() + 6000;
    let s = statoSessione(studioId);
    while (Date.now() < scadenza && s.stato !== 'connesso' && !s.qr) {
      await new Promise((r) => setTimeout(r, 200));
      s = statoSessione(studioId);
    }
    res.json({ stato: s.stato, numero: s.numero ?? undefined, qr: s.qr });
  } catch (errore) {
    res.status(502).json({ error: errore instanceof Error ? errore.message : 'Avvio non riuscito' });
  }
});

app.get('/studi/:studioId/stato', (req, res) => {
  const s = statoSessione(req.params.studioId);
  res.json({ stato: s.stato, numero: s.numero ?? undefined });
});

app.post('/studi/:studioId/disconnetti', async (req, res) => {
  await disconnetti(req.params.studioId);
  res.json({ ok: true });
});

app.post('/studi/:studioId/invia', async (req, res) => {
  const { a, testo } = req.body ?? {};
  if (typeof a !== 'string' || typeof testo !== 'string' || !testo.trim()) {
    res.status(400).json({ error: 'Parametri mancanti' });
    return;
  }
  try {
    const waMessageId = await invia(req.params.studioId, a, testo);
    res.json({ ok: true, waMessageId });
  } catch (errore) {
    res.status(502).json({ error: errore instanceof Error ? errore.message : 'Invio non riuscito' });
  }
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`Servizio WhatsApp in ascolto sulla porta ${PORT}`);
  ripristinaSessioniEsistenti();
});

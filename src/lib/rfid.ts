import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Token con cui l'app "Fascicoli RFID" del Mac si presenta a Themis.
 *
 * Si mostra una sola volta, alla creazione: nel database resta solo
 * l'impronta SHA-256 (più i primi caratteri, per riconoscerlo nell'elenco).
 * Un token a caso da 32 byte non ha bisogno di un hash lento come una
 * password: non si può indovinare per tentativi.
 */
export function nuovoTokenLettore() {
  const token = `rfid_${randomBytes(32).toString('base64url')}`;
  return { token, hash: impronta(token), inizio: token.slice(0, 10) };
}

export function impronta(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

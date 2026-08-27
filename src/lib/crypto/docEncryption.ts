import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

// Cifra ogni file (template, intestazione, documento generato) prima di
// salvarlo su Supabase Storage, così anche in caso di accesso diretto al
// bucket (chiave di servizio trapelata, errore di configurazione, backup
// esposto per sbaglio) il contenuto resta illeggibile senza questa chiave,
// che vive SOLO nelle variabili d'ambiente del server (mai nel database, mai
// spedita al browser).
//
// Ogni studio ha una chiave DERIVATA diversa (via HKDF, scope = studio_id):
// un'unica chiave master compromessa in astratto non basta a violare tutti
// gli studi contemporaneamente se un attaccante ottenesse solo il blob di
// UNO di essi in qualche altro modo — difesa in profondità, non l'unica
// barriera (quella resta la Row Level Security sulle tabelle).
//
// Formato del blob: IV (12 byte) || CIPHERTEXT || AUTH TAG (16 byte).
// Stesso identico formato prodotto da AESGCM.encrypt() in Python
// (KEVIN_ONLY_NON_DISTRIBUIRE/doc_encryption.py) — permette di cifrare da
// uno script Python e decifrare qui senza conversioni.

const HKDF_SALT = 'themis-doc-key';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const b64 = process.env.DOCUMENT_ENCRYPTION_MASTER_KEY;
  if (!b64) throw new Error('DOCUMENT_ENCRYPTION_MASTER_KEY non configurata');
  return Buffer.from(b64, 'base64');
}

export function deriveKey(scope: string): Buffer {
  const derived = hkdfSync('sha256', getMasterKey(), HKDF_SALT, scope, 32);
  return Buffer.from(derived);
}

export function encryptBuffer(plaintext: Buffer, scope: string): Buffer {
  const key = deriveKey(scope);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]);
}

export function decryptBuffer(blob: Buffer, scope: string): Buffer {
  const key = deriveKey(scope);
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(blob.length - TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH, blob.length - TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Scope da usare per i template/documenti "di sistema" (non di un singolo studio). */
export const SYSTEM_SCOPE = 'system';

import 'server-only';
import { createPrivateKey, sign } from 'node:crypto';

// Genera una chiave THM-... nello stesso identico formato di
// backend/license.py (payload "1|{license_id}|{expires_at}|{plan}", firma
// Ed25519, base32 RFC4648 senza padding raggruppata a 5). Riusa
// deliberatamente la STESSA coppia di chiavi già esistente in
// KEVIN_ONLY_NON_DISTRIBUIRE/themis_private_key.pem (copiata in
// LICENSE_ED25519_PRIVATE_KEY_PEM): una coppia nuova produrrebbe firme che
// non corrispondono più alla chiave pubblica già imbustata in
// backend/license.py e (probabilmente) verificata da redeem_license().
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const KEY_PREFIX = 'THM-';

function base32Encode(bytes: Uint8Array): string {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  const padLength = (5 - (bits.length % 5)) % 5;
  bits += '0'.repeat(padLength);
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function buildPayload(licenseId: string, expiresAt: string, plan: string): Buffer {
  return Buffer.from(`1|${licenseId}|${expiresAt}|${plan}`, 'utf-8');
}

export function generateLicenseKey(licenseId: string, expiresAt: string, plan: string): string {
  const payload = buildPayload(licenseId, expiresAt, plan);
  const privateKey = createPrivateKey({
    key: process.env.LICENSE_ED25519_PRIVATE_KEY_PEM!,
    format: 'pem',
  });
  const signature = sign(null, payload, privateKey);
  const blob = Buffer.concat([payload, signature]);
  const grouped = base32Encode(blob).match(/.{1,5}/g)!.join('-');
  return `${KEY_PREFIX}${grouped}`;
}

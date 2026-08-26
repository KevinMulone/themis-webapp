// Estrae solo il license_id da una chiave THM-... generata da keygen.py,
// senza verificarne la firma: la verifica vera (chiave esistente, non già
// usata) avviene lato server nella funzione Postgres redeem_license().
// Stessa codifica di backend/license.py: base32 (RFC4648) senza padding,
// prefisso "THM-", raggruppata a blocchi di 5 separati da "-".

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SIGNATURE_LENGTH = 64;

function base32Decode(input: string): Uint8Array {
  let bits = '';
  for (const char of input) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Carattere non valido nella chiave');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export function extractLicenseId(rawKey: string): string {
  let s = rawKey.trim().replace(/\s+/g, '').toUpperCase();
  if (s.startsWith('THM-')) s = s.slice(4);
  s = s.replace(/-/g, '');
  if (!s) throw new Error('Chiave vuota');
  const bytes = base32Decode(s);
  if (bytes.length <= SIGNATURE_LENGTH) throw new Error('Chiave troppo corta');
  const payloadBytes = bytes.slice(0, bytes.length - SIGNATURE_LENGTH);
  const payload = new TextDecoder('utf-8').decode(payloadBytes);
  const parts = payload.split('|');
  if (parts.length < 2 || !parts[1]) throw new Error('Chiave non valida');
  return parts[1];
}

/**
 * Numero WhatsApp ↔ cliente: unico posto dove si decide se due numeri
 * sono "lo stesso numero".
 *
 * `clients.telefono` è un campo libero scritto a mano — con o senza
 * prefisso, con spazi o trattini — mentre WhatsApp manda un JID con il
 * numero in formato internazionale pulito. Confrontarli carattere per
 * carattere fallirebbe quasi sempre: si confrontano invece le ultime
 * cifre, che per un numero italiano bastano a essere certi.
 */

/** Toglie tutto il non numerico e un eventuale prefisso Italia iniziale. */
export function normalizzaNumero(grezzo: string): string {
  const soleCifre = grezzo.replace(/\D/g, '');
  return soleCifre.startsWith('39') && soleCifre.length > 10
    ? soleCifre.slice(2)
    : soleCifre;
}

/**
 * Due numeri sono lo stesso numero se, spogliati di prefisso e
 * formattazione, condividono le ultime 9 cifre — un cellulare italiano ne
 * ha 9 o 10 dopo il prefisso, e confrontare solo le ultime 9 assorbe
 * l'eventuale zero iniziale scritto per abitudine da chi arriva dal fisso.
 */
export function numeriEquivalenti(a: string, b: string): boolean {
  const na = normalizzaNumero(a);
  const nb = normalizzaNumero(b);
  if (na.length < 8 || nb.length < 8) return false;
  return na.slice(-9) === nb.slice(-9);
}

/** Il numero "puro" dentro un JID WhatsApp (`393331234567@s.whatsapp.net`). */
export function numeroDaJid(jid: string): string {
  return normalizzaNumero(jid.split('@')[0] ?? jid);
}

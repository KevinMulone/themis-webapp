export type TipoEvento = 'udienza' | 'termine_processuale' | 'scadenza' | 'appuntamento' | 'altro';

/** Classificazione prudente: assegna un tipo solo quando il testo contiene
 * parole inequivoche. Nei casi dubbi mantiene "altro". */
export function classificaEvento(titolo: string | null, note?: string | null): TipoEvento {
  const testo = `${titolo ?? ''} ${note ?? ''}`.toLocaleLowerCase('it');
  if (/\b(udienza|comparizione|discussione|camera di consiglio)\b/.test(testo)) return 'udienza';
  if (/\b(termine processuale|deposito memoria|memoria 183|comparsa conclusionale|replica|impugnazione)\b/.test(testo)) return 'termine_processuale';
  if (/\b(scadenza|entro il|ultimo giorno)\b/.test(testo)) return 'scadenza';
  if (/\b(appuntamento|incontro|call|riunione|colloquio)\b/.test(testo)) return 'appuntamento';
  return 'altro';
}

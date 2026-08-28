/**
 * Formatta una data come YYYY-MM-DD usando i componenti locali del browser
 * (getFullYear/getMonth/getDate). Da usare SEMPRE al posto di
 * `date.toISOString().slice(0, 10)` nel codice lato client: toISOString()
 * converte in UTC e, per un fuso orario a est di UTC come Europe/Rome, può
 * restituire il giorno precedente rispetto a quello mostrato sull'orologio
 * dell'utente — un errore critico per confronti di scadenze e abbonamenti.
 *
 * Nel codice che gira solo lato server (Route Handler, Server Component) il
 * problema non si presenta perché Vercel esegue in UTC, ma è comunque più
 * chiaro usare questa funzione ovunque si maneggino date-senza-ora.
 */
export function toIsoLocale(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function oggiIso(): string {
  return toIsoLocale(new Date());
}

/**
 * Somma `days` giorni a `base` (YYYY-MM-DD), o a oggi se `base` è nel
 * passato o assente — mai si "perdono" giorni già pagati/estesi.
 */
export function addDaysIso(base: string | null, days: number): string {
  const start = base && base > oggiIso() ? new Date(base) : new Date();
  start.setDate(start.getDate() + days);
  return toIsoLocale(start);
}

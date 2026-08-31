import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { creditoAiMensileCent } from '@/lib/stripe/plans';
import { PREZZO_USD_PER_MILIONE, CAMBIO_USD_EUR } from './claude';

/** Primo giorno del mese corrente, in formato data. */
function meseCorrente(): string {
  const oggi = new Date();
  return `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Costo di una risposta, in millesimi di euro. */
export function costoMillesimi(usage: Anthropic.Usage): number {
  const perMilione = (token: number, prezzoUsd: number) =>
    (token / 1_000_000) * prezzoUsd * CAMBIO_USD_EUR * 1000;

  return Math.round(
    perMilione(usage.input_tokens ?? 0, PREZZO_USD_PER_MILIONE.input)
    + perMilione(usage.output_tokens ?? 0, PREZZO_USD_PER_MILIONE.output)
    + perMilione(usage.cache_read_input_tokens ?? 0, PREZZO_USD_PER_MILIONE.cacheLettura)
    + perMilione(usage.cache_creation_input_tokens ?? 0, PREZZO_USD_PER_MILIONE.cacheScrittura),
  );
}

export type Credito = {
  /** Millesimi di euro spesi questo mese. */
  usatoMillesimi: number;
  /** Millesimi di euro disponibili nel mese, secondo il piano. */
  totaleMillesimi: number;
  residuoMillesimi: number;
  esaurito: boolean;
};

/**
 * Quanto resta allo studio questo mese.
 *
 * Il conteggio passa dal client di servizio perché deve essere
 * autorevole: una lettura filtrata dalle regole del database
 * andrebbe bene, ma qui si decide se spendere denaro di Kevin, e
 * quel giudizio non deve dipendere da come è configurato l'accesso.
 */
export async function creditoStudio(studioId: string, plan: string | null): Promise<Credito> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ai_utilizzo')
    .select('costo_millesimi')
    .eq('studio_id', studioId)
    .eq('mese', meseCorrente());

  // Se il consumo non si riesce a leggere (tabella mancante, database
  // irraggiungibile), NON si prosegue come se fosse zero: una lettura
  // vuota e un errore si assomigliano troppo, e confonderli significa
  // spendere senza tetto. Nel dubbio si nega.
  if (error) {
    return { usatoMillesimi: 0, totaleMillesimi: 0, residuoMillesimi: 0, esaurito: true };
  }

  const usatoMillesimi = (data ?? []).reduce((somma, r) => somma + (r.costo_millesimi ?? 0), 0);

  // Il limite lo regola Kevin dal pannello admin mentre osserva il consumo
  // reale. La costante nel codice resta solo come valore di ripiego, se la
  // riga per quel piano non c'è.
  const { data: limite } = plan
    ? await admin.from('limiti_assistente').select('credito_cent').eq('plan', plan).maybeSingle()
    : { data: null };
  const totaleMillesimi = (limite?.credito_cent ?? creditoAiMensileCent(plan)) * 10;

  return {
    usatoMillesimi,
    totaleMillesimi,
    residuoMillesimi: Math.max(0, totaleMillesimi - usatoMillesimi),
    esaurito: usatoMillesimi >= totaleMillesimi,
  };
}

/**
 * Registra il consumo di una richiesta. Va chiamata SEMPRE dopo una
 * risposta, anche quando la risposta non serve più a nulla: i token sono
 * stati comunque spesi, e un consumo non registrato è un tetto che non
 * tiene.
 */
export async function registraUtilizzo(
  studioId: string,
  funzione: 'domanda' | 'scadenze' | 'bozza',
  usage: Anthropic.Usage,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('ai_utilizzo').insert({
    studio_id: studioId,
    mese: meseCorrente(),
    funzione,
    token_input: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
      + (usage.cache_creation_input_tokens ?? 0),
    token_output: usage.output_tokens ?? 0,
    costo_millesimi: costoMillesimi(usage),
  });
  // Un consumo non registrato è un tetto che non tiene: lo si vede nei
  // log del server anche se la richiesta dell'utente è andata a buon fine.
  if (error) console.error('Consumo AI non registrato:', error.message);
}

/** Per mostrare il credito in interfaccia: «1,20 € di 5,00 €». */
export function euro(millesimi: number): string {
  return `${(millesimi / 1000).toFixed(2).replace('.', ',')} €`;
}

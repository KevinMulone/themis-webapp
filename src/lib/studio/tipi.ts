// Tipi condivisi fra il risolutore lato server (contesto.ts) e il context
// React lato client (StudioProvider.tsx). Stanno in un file a parte, senza
// direttive, così entrambi possono importarli senza che il client tiri
// dentro codice marcato "server-only".

export type Ruolo = 'titolare' | 'collaboratore';

/**
 * Chi sta usando l'app, e per conto di quale studio.
 *
 * REGOLA DA NON DIMENTICARE, è l'errore più facile da commettere qui:
 *  - `studioId` è la chiave dei DATI DELLO STUDIO (clienti, pratiche,
 *    documenti, percorsi nello storage, scope di cifratura). Per un
 *    titolare coincide con `userId`; per un collaboratore no.
 *  - `userId` è la chiave dell'IDENTITÀ e della FATTURAZIONE (chi ha fatto
 *    cosa, abbonamento Stripe, riscatto licenze). Lì `studioId` non va
 *    sostituito per riflesso: l'abbonamento è del titolare, non dello
 *    studio inteso come gruppo di persone.
 */
export type ContestoStudio = {
  userId: string;
  studioId: string;
  ruolo: Ruolo;
  nomeStudio: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
};

/** Il sottoinsieme del contesto passato alle pagine client. Volutamente
 *  senza i campi dell'abbonamento: quelli servono solo al layout e alle
 *  route riservate al titolare. */
export type ContestoStudioClient = Pick<
  ContestoStudio,
  'userId' | 'studioId' | 'ruolo' | 'nomeStudio'
>;

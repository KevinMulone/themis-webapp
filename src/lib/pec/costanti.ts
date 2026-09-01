/**
 * Quanti messaggi si scaricano al massimo per ogni giro di
 * sincronizzazione. Tiene la durata della route indipendente
 * dall'arretrato: una casella con anni di messaggi si svuota in più giri
 * invece di far scadere la funzione.
 *
 * Sta in un file a parte, senza `server-only`, perché serve anche
 * all'interfaccia: è quella che deve dire «ce n'è ancora».
 */
export const MAX_MESSAGGI_PER_GIRO = 25;

// Perché 25 e non 10: dieci per giro significavano ventisei giri per una
// casella da 260 messaggi, e mezz'ora di attesa. Il costo per messaggio è
// dominato dal caricamento nello storage, non dalla lettura IMAP: con due
// minuti di tempo concesso alla funzione, venticinque stanno larghi.
// Se un giorno una casella dovesse far scadere il giro, questo è il numero
// da abbassare — non il tempo da alzare.

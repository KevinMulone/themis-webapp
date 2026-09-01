/**
 * Quanti messaggi si scaricano al massimo per ogni giro di
 * sincronizzazione. Tiene la durata della route indipendente
 * dall'arretrato: una casella con anni di messaggi si svuota in più giri
 * invece di far scadere la funzione.
 *
 * Sta in un file a parte, senza `server-only`, perché serve anche
 * all'interfaccia: è quella che deve dire «ce n'è ancora».
 */
export const MAX_MESSAGGI_PER_GIRO = 10;

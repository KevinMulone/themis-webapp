-- 020 — PEC: due segnalibri invece di uno
-- STATO: NON ancora applicata. Va eseguita dopo la 019.
--
-- Con un solo segnalibro la sincronizzazione parte dal messaggio più
-- vecchio e avanza: le PEC di oggi arrivano per ultime, dopo mesi di
-- arretrato. È il contrario di quello che serve.
--
-- Con due segnalibri la casella si legge dai due capi:
--   last_seen_uid    — il più alto già preso: sopra ci sono le PEC NUOVE,
--                      e quelle si scaricano sempre per prime;
--   arretrato_fino_a — il più basso già preso: sotto c'è il passato, che
--                      si recupera a ritroso quando si vuole.
-- Così la prima sincronizzazione porta subito le ultime dieci, e
-- l'arretrato è un'operazione separata che non ruba il posto alle nuove.

alter table public.pec_cartelle
  add column if not exists arretrato_fino_a bigint;

select percorso, ruolo, last_seen_uid, arretrato_fino_a
  from public.pec_cartelle order by ruolo;

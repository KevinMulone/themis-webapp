-- 036 — Una sola notifica per PEC e classificazione separata delle bozze PEC
-- STATO: DA APPLICARE.
--
-- La migrazione 024 ha sostituito la notifica PEC generica della 010 con
-- una notifica idempotente e indirizzata al titolare, ma il vecchio trigger
-- era rimasto attivo. Ogni messaggio generava quindi due notifiche.

drop trigger if exists trg_notifica_pec on public.pec_messaggi;
drop function if exists public.notifica_pec();

-- `funzione` è text nello schema attuale: non serve modificare la tabella.
-- Da questo deploy le bozze PEC vengono registrate come `pec`, distinte da
-- `bozza`, che resta riservata alla redazione degli atti.

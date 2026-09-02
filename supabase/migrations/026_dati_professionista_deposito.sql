-- 026 — Dati anagrafici del professionista, per il prontuario di deposito
-- STATO: NON ancora applicata.
--
-- SLpct (e ogni redattore atti PCT) chiede, nella schermata "Avvocato", i
-- dati anagrafici del difensore: cognome, nome, codice fiscale e il
-- domicilio fisico. Themis non li aveva mai chiesti finora — sapeva solo
-- il nome dello studio (studios.nome_studio) e l'indirizzo PEC (già in
-- pec_account) — quindi il prontuario di deposito, senza questi campi,
-- avrebbe una voce vuota proprio dove serve di più: i dati di chi firma.
--
-- Vivono su studio_settings e non su studios apposta: studios è la riga
-- di fatturazione e login (si legge con service role in molte route), qui
-- servono dati che il titolare compila una volta sola dalle Impostazioni,
-- nello stesso posto dove già imposta carattere e interlinea degli atti.

alter table public.studio_settings
  add column if not exists avvocato_cognome text,
  add column if not exists avvocato_nome text,
  add column if not exists avvocato_codice_fiscale text,
  add column if not exists avvocato_indirizzo text,
  add column if not exists avvocato_cap text,
  add column if not exists avvocato_citta text,
  add column if not exists avvocato_provincia text;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'studio_settings'
   and column_name like 'avvocato_%'
 order by column_name;

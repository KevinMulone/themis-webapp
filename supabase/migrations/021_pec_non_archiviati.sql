-- 021 — PEC: la traccia resta anche quando l'originale non entra
-- STATO: NON ancora applicata.
--
-- Lo storage ha un limite per file (50 MB sul piano gratuito) e una PEC
-- con un allegato pesante lo supera: il .eml gonfia di un terzo per via
-- della codifica. Finora quel messaggio veniva saltato e spariva.
--
-- Per una PEC, però, sapere CHE COSA è arrivato e QUANDO è spesso il dato
-- che conta di più — è quello che prova il rispetto di un termine. Perderlo
-- perché non c'era posto per l'allegato è il baratto sbagliato.

alter table public.pec_messaggi
  alter column storage_path_eml drop not null;

alter table public.pec_messaggi
  add column if not exists archiviato boolean not null default true;

alter table public.pec_messaggi
  add column if not exists nota_archivio text;

select count(*) filter (where archiviato) as con_originale,
       count(*) filter (where not archiviato) as senza_originale
  from public.pec_messaggi;

-- 022 — PEC: i parametri per inviare
-- STATO: NON ancora applicata.
--
-- Finora la casella si leggeva soltanto. Per inviare serve il server SMTP,
-- che è un altro indirizzo e un'altra porta rispetto a IMAP.
--
-- Il valore di riserva ricava l'host di invio da quello di lettura
-- (imaps.dominio → smtps.dominio) perché è la convenzione di quasi tutti i
-- gestori PEC italiani, Namirial compreso. Resta correggibile a mano: una
-- convenzione non è una garanzia.

alter table public.pec_account
  add column if not exists smtp_host text,
  add column if not exists smtp_port integer not null default 465;

update public.pec_account
   set smtp_host = replace(imap_host, 'imaps.', 'smtps.')
 where smtp_host is null;

select etichetta, imap_host, smtp_host, smtp_port from public.pec_account;

-- 032 — Spunte di lettura sui messaggi WhatsApp mandati da Themis
-- STATO: NON ancora applicata.
--
-- 'inviato' (1 spunta) -> 'consegnato' (2 grigie) -> 'letto' (2 blu).
-- Ha senso solo per direzione = 'out': di un messaggio ricevuto non si
-- parla di "letto", lo si è già letto guardandolo qui.

alter table public.whatsapp_messaggi
  add column if not exists stato_invio text
    check (stato_invio is null or stato_invio in ('inviato', 'consegnato', 'letto'));

select count(*) as messaggi from public.whatsapp_messaggi;

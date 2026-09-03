-- 031 — Il nome con cui il mittente si presenta su WhatsApp
-- STATO: NON ancora applicata.
--
-- Finché un messaggio non è collegato a un cliente, in Themis compariva
-- solo il numero di telefono: qui si salva anche il nome che il mittente
-- ha impostato sul proprio profilo WhatsApp (il "pushName" mandato da
-- WhatsApp con ogni messaggio), da mostrare come alternativa migliore al
-- numero nudo — resta comunque un nome scritto dal mittente stesso, non
-- verificato, per questo non sostituisce mai il nome del cliente quando
-- il messaggio è abbinato.

alter table public.whatsapp_messaggi
  add column if not exists nome_whatsapp text;

select count(*) as messaggi from public.whatsapp_messaggi;

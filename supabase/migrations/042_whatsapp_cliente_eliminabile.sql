-- 042 — Un cliente con messaggi WhatsApp collegati si può eliminare
-- STATO: da applicare (SQL editor di Supabase, una volta sola; si può rieseguire).
--
-- whatsapp_messaggi.cliente_id puntava a clients senza dire cosa fare alla
-- cancellazione del cliente: il database rifiutava l'eliminazione ("questo
-- cliente ha pratiche o documenti collegati") finché esisteva anche un solo
-- messaggio. Come già fa matter_id sulla stessa tabella, il collegamento si
-- scioglie: il messaggio resta, senza più un cliente riconosciuto.

alter table public.whatsapp_messaggi
  drop constraint if exists whatsapp_messaggi_cliente_id_fkey;
alter table public.whatsapp_messaggi
  add constraint whatsapp_messaggi_cliente_id_fkey
  foreign key (cliente_id) references public.clients(id) on delete set null;

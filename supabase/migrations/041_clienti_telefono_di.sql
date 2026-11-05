-- 041 — Clienti: di chi è il numero di telefono
-- STATO: da applicare (SQL editor di Supabase, una volta sola; si può rieseguire).
--
-- Molti clienti (anziani, minori, persone assistite) si raggiungono tramite un
-- familiare: accanto al telefono si segna se è del cliente stesso o di un
-- parente / referente. Vuoto = il numero è del cliente.

alter table public.clients
  add column if not exists telefono_di text;

alter table public.clients drop constraint if exists clients_telefono_di_check;
alter table public.clients add constraint clients_telefono_di_check
  check (telefono_di is null or telefono_di in (
    'madre', 'padre', 'figlio', 'figlia', 'coniuge', 'fratello', 'sorella',
    'altro_familiare', 'tutore', 'caregiver', 'altro'
  ));

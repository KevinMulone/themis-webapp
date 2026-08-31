-- 011 — Aggiornamento in tempo reale
-- STATO: NON ancora applicata.
--
-- Abilita Supabase Realtime sulle tabelle che cambiano mentre qualcuno sta
-- guardando la pagina. Il database annuncia le modifiche e il browser le
-- riceve su una connessione aperta: nessuna interrogazione ripetuta.
--
-- Le regole di sicurezza continuano a valere: Realtime consegna a ciascuno
-- solo le righe che quella persona potrebbe comunque leggere. Un
-- collaboratore non riceve le notifiche di un altro studio, né quelle
-- personali altrui.

-- Ripetibile: aggiungere una tabella già presente nella pubblicazione
-- darebbe errore, quindi si controlla prima.
do $$
declare t text;
begin
  foreach t in array array[
    'notifiche', 'incarichi', 'incarichi_storico', 'document_requests', 'appointments'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- REPLICA IDENTITY FULL serve perché, su modifica e cancellazione,
-- PostgreSQL trasmetta la riga intera: senza, arriverebbe la sola chiave
-- primaria e Realtime non potrebbe verificare le regole di sicurezza sulla
-- riga vecchia, quindi non consegnerebbe l'evento a nessuno.
-- Costo: un po' più di dati scritti nel registro delle modifiche. Su questi
-- volumi è trascurabile.
alter table public.notifiche replica identity full;
alter table public.incarichi replica identity full;
alter table public.incarichi_storico replica identity full;
alter table public.document_requests replica identity full;
alter table public.appointments replica identity full;

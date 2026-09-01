-- 023 — Le PEC compaiono da sole, senza ricaricare la pagina
-- STATO: NON ancora applicata.
--
-- pec_messaggi non era fra le tabelle pubblicate in tempo reale: una PEC
-- appena scaricata restava invisibile finché non si ricaricava a mano.

do $$
declare t text;
begin
  foreach t in array array['pec_messaggi', 'pec_account'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
 order by tablename;

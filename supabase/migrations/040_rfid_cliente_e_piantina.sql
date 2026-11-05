-- 040 — Fascicoli RFID: associazione al cliente e piantina dello studio
-- STATO: da applicare (SQL editor di Supabase, una volta sola; si può rieseguire).
--
-- 1) Un'etichetta si associa a un CLIENTE (non più solo a una pratica): lo
--    studio archivia i fascicoli per cliente. La pratica resta possibile
--    (matter_id) per le associazioni già fatte.
-- 2) La piantina dello studio vive in Themis e la modifica lo studio, come
--    nell'app del Mac: una riga per studio con l'elenco delle stanze in JSON
--    (nome, posizione, misura, antenna). All'inizio la riga si crea da sola
--    con quella disegnata sul Mac (route /api/rfid/sync); poi comanda Themis.

alter table public.rfid_etichette
  add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists rfid_etichette_client_idx on public.rfid_etichette(client_id);

-- Lo studio punta solo ai propri clienti e alle proprie pratiche: senza il
-- controllo si potrebbe puntare un'etichetta verso l'id di un cliente altrui.
drop policy if exists studio_isolato on public.rfid_etichette;
create policy studio_isolato on public.rfid_etichette for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (
    studio_id = public.studio_corrente()
    and (
      matter_id is null
      or exists (select 1 from public.matters m where m.id = matter_id and m.studio_id = public.studio_corrente())
    )
    and (
      client_id is null
      or exists (select 1 from public.clients c where c.id = client_id and c.studio_id = public.studio_corrente())
    )
  );

create table if not exists public.rfid_mappa (
  studio_id uuid primary key references public.studios(id) on delete cascade,
  stanze jsonb not null default '[]'::jsonb check (jsonb_typeof(stanze) = 'array'),
  aggiornata_at timestamptz not null default now()
);

alter table public.rfid_mappa enable row level security;

drop policy if exists studio_isolato on public.rfid_mappa;
create policy studio_isolato on public.rfid_mappa for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (studio_id = public.studio_corrente());

-- Aggiornamento dal vivo della pagina, come nella 039.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rfid_mappa'
  ) then
    alter publication supabase_realtime add table public.rfid_mappa;
  end if;
end $$;

alter table public.rfid_mappa replica identity full;

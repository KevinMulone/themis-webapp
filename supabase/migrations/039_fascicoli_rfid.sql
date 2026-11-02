-- 039 — Fascicoli fisici con etichette RFID
-- STATO: applicata il 02.11.2026.
--
-- Dove si trova il fascicolo di carta. Nello studio un lettore UHF con
-- un'antenna per stanza legge le etichette attaccate ai fascicoli; il Mac a
-- cui è collegato (app "Fascicoli RFID") calcola la stanza e manda qui
-- posizioni e spostamenti. Themis non parla mai con il lettore: riceve solo
-- quello che il Mac ha già deciso.
--
-- Chi scrive cosa:
--  - lettori, stanze, posizioni e spostamenti li scrive SOLO la route
--    /api/rfid/sync con la service role, dopo aver riconosciuto il token del
--    lettore. Per gli utenti sono in sola lettura: uno spostamento è un fatto
--    registrato dall'antenna, non qualcosa che si corregge a mano.
--  - le etichette (quale tag sta su quale pratica) le gestisce lo studio
--    dall'interfaccia, titolare e collaboratori.
--
-- Del token del lettore si conserva solo l'impronta SHA-256: chi legge la
-- tabella non può ricavarne il token, e un token perso si revoca e se ne
-- crea un altro.

create table if not exists public.rfid_lettori (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  nome text not null,
  token_hash text not null unique,
  token_inizio text not null,
  created_at timestamptz not null default now(),
  ultimo_contatto timestamptz,
  revocato_at timestamptz
);
create index if not exists rfid_lettori_studio_idx on public.rfid_lettori(studio_id);

-- Le stanze sono quelle impostate sul Mac (un'antenna = una stanza): Themis
-- le riceve a ogni sincronizzazione e non le modifica.
create table if not exists public.rfid_stanze (
  lettore_id uuid not null references public.rfid_lettori(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  antenna integer not null,
  nome text not null,
  attiva boolean not null default true,
  uscita boolean not null default false,
  primary key (lettore_id, antenna)
);

create table if not exists public.rfid_etichette (
  studio_id uuid not null references public.studios(id) on delete cascade,
  epc text not null check (epc ~ '^[0-9A-F]{4,64}$'),
  matter_id uuid references public.matters(id) on delete set null,
  descrizione text,
  created_at timestamptz not null default now(),
  primary key (studio_id, epc)
);
create index if not exists rfid_etichette_matter_idx on public.rfid_etichette(matter_id);

-- Una riga per etichetta: l'ultima stanza nota. Anche le etichette non
-- ancora associate a una pratica, così si possono associare da qui.
create table if not exists public.rfid_posizioni (
  studio_id uuid not null references public.studios(id) on delete cascade,
  epc text not null,
  lettore_id uuid references public.rfid_lettori(id) on delete set null,
  antenna integer,
  stanza text,
  rssi integer,
  dal timestamptz not null,
  ultimo_visto timestamptz not null,
  primary key (studio_id, epc)
);

-- id_locale è l'id dello spostamento nel database del Mac: se un invio va
-- ripetuto (rete caduta a metà), lo stesso spostamento non si duplica.
create table if not exists public.rfid_movimenti (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios(id) on delete cascade,
  lettore_id uuid references public.rfid_lettori(id) on delete set null,
  id_locale bigint,
  epc text not null,
  da_stanza text,
  a_stanza text,
  ts timestamptz not null,
  unique (lettore_id, id_locale)
);
create index if not exists rfid_movimenti_studio_ts_idx on public.rfid_movimenti(studio_id, ts desc);
create index if not exists rfid_movimenti_epc_idx on public.rfid_movimenti(studio_id, epc, ts desc);

alter table public.rfid_lettori enable row level security;
alter table public.rfid_stanze enable row level security;
alter table public.rfid_etichette enable row level security;
alter table public.rfid_posizioni enable row level security;
alter table public.rfid_movimenti enable row level security;

-- Sola lettura per lo studio: nessuna policy di scrittura, quindi scrive
-- solo la service role.
do $$
declare tabella text;
begin
  foreach tabella in array array['rfid_lettori','rfid_stanze','rfid_posizioni','rfid_movimenti'] loop
    execute format('drop policy if exists studio_legge on public.%I', tabella);
    execute format(
      'create policy studio_legge on public.%I for select to authenticated using (studio_id = public.studio_corrente())',
      tabella
    );
  end loop;
end $$;

-- Le etichette le gestisce lo studio, ma solo verso le proprie pratiche:
-- senza il controllo su matters si potrebbe puntare una propria etichetta
-- verso l'id di una pratica di un altro studio.
drop policy if exists studio_isolato on public.rfid_etichette;
create policy studio_isolato on public.rfid_etichette for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (
    studio_id = public.studio_corrente()
    and (
      matter_id is null
      or exists (select 1 from public.matters m where m.id = matter_id and m.studio_id = public.studio_corrente())
    )
  );

-- Aggiornamento dal vivo della pagina, come nella 011.
do $$
declare t text;
begin
  foreach t in array array['rfid_lettori', 'rfid_etichette', 'rfid_posizioni', 'rfid_movimenti'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

alter table public.rfid_lettori replica identity full;
alter table public.rfid_etichette replica identity full;
alter table public.rfid_posizioni replica identity full;
alter table public.rfid_movimenti replica identity full;

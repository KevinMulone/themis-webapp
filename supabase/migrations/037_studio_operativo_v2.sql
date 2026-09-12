-- 037 — Studio operativo v2
-- Applica questa migrazione dopo la 036. Le aggiunte sono compatibili con
-- i dati esistenti e non modificano né cancellano record preesistenti.

-- Parti e professionisti collegati alla pratica: il cliente principale
-- resta in matters.client_id per compatibilità con l'app attuale.
create table if not exists public.matter_parti (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  ruolo text not null check (ruolo in ('assistito','controparte','avvocato_controparte','consulente','testimone','altro')),
  nome text,
  contatti text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists matter_parti_matter_idx on public.matter_parti(matter_id, ruolo);

-- Registro delle verifiche professionali: il loro esito è storico e non
-- viene nascosto quando cambiano i dati dell'anagrafica.
create table if not exists public.verifiche_cliente (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  tipo text not null check (tipo in ('conflitto_interessi','adeguata_verifica','privacy','mandato')),
  esito text not null check (esito in ('da_verificare','positivo','negativo','non_applicabile')),
  note text,
  verificato_da uuid,
  verificato_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists verifiche_cliente_idx on public.verifiche_cliente(client_id, tipo, verificato_at desc);

-- Metadati e versioni documentali. Le colonne opzionali permettono di
-- aggiornare l'interfaccia senza dover migrare i file cifrati esistenti.
alter table public.documenti add column if not exists versione integer not null default 1;
alter table public.documenti add column if not exists documento_padre_id uuid references public.documenti(id) on delete set null;
alter table public.documenti add column if not exists categoria text;
alter table public.documenti add column if not exists tags text[] not null default '{}';
alter table public.documenti add column if not exists hash_sha256 text;
alter table public.documenti add column if not exists caricato_da uuid;
alter table public.documenti add column if not exists dimensione_bytes bigint;

-- Conversazioni Themis persistenti e collegate al fascicolo.
create table if not exists public.themis_conversazioni (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  creato_da uuid not null,
  titolo text not null default 'Conversazione Themis',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.themis_messaggi (
  id bigint generated always as identity primary key,
  conversazione_id uuid not null references public.themis_conversazioni(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  ruolo text not null check (ruolo in ('utente','themis')),
  testo text not null,
  citazioni jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists themis_conversazioni_matter_idx on public.themis_conversazioni(matter_id, updated_at desc);
create index if not exists themis_messaggi_conversazione_idx on public.themis_messaggi(conversazione_id, created_at);

-- Pianificazione del lavoro, senza cambiare il flusso già esistente.
alter table public.incarichi add column if not exists stima_minuti integer check (stima_minuti is null or stima_minuti >= 0);
alter table public.incarichi add column if not exists minuti_effettivi integer check (minuti_effettivi is null or minuti_effettivi >= 0);
alter table public.incarichi add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.incarichi add column if not exists ricorrenza text;
alter table public.incarichi add column if not exists dipende_da uuid references public.incarichi(id) on delete set null;

alter table public.eventi add column if not exists assegnato_a uuid;
alter table public.eventi add column if not exists priorita text not null default 'normale';
alter table public.eventi add column if not exists stato text not null default 'programmato';
alter table public.eventi add column if not exists origine text not null default 'manuale';
alter table public.eventi add column if not exists external_uid text;
create unique index if not exists eventi_external_uid_idx on public.eventi(studio_id, external_uid) where external_uid is not null;

-- Calcoli e preventivi possono essere conservati nel fascicolo con uno
-- snapshot immutabile dei dati che hanno prodotto il risultato.
create table if not exists public.calcoli_pratica (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  tipo text not null check (tipo in ('danno','parcella','interessi','altro')),
  titolo text not null,
  input jsonb not null default '{}'::jsonb,
  risultato jsonb not null default '{}'::jsonb,
  creato_da uuid,
  created_at timestamptz not null default now()
);
create index if not exists calcoli_pratica_idx on public.calcoli_pratica(matter_id, created_at desc);

-- RLS: ogni modulo resta confinato allo studio corrente.
alter table public.matter_parti enable row level security;
alter table public.verifiche_cliente enable row level security;
alter table public.themis_conversazioni enable row level security;
alter table public.themis_messaggi enable row level security;
alter table public.calcoli_pratica enable row level security;

do $$
declare tabella text;
begin
  foreach tabella in array array['matter_parti','verifiche_cliente','themis_conversazioni','themis_messaggi','calcoli_pratica'] loop
    execute format('drop policy if exists studio_isolato on public.%I', tabella);
    execute format(
      'create policy studio_isolato on public.%I for all to authenticated using (studio_id = public.studio_corrente()) with check (studio_id = public.studio_corrente())',
      tabella
    );
  end loop;
end $$;

-- Lo storico degli incarichi viene esteso automaticamente anche alle
-- variazioni di priorità e pianificazione tramite il trigger già presente.

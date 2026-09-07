-- 035 — Sponsor a pagamento + elenco pubblico studi Premium (piano annuale)

alter table studios
  add column if not exists elenco_pubblico boolean not null default false,
  add column if not exists elenco_paese text,
  add column if not exists elenco_via text,
  add column if not exists elenco_citta text,
  add column if not exists elenco_cap text,
  add column if not exists elenco_sito text;

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  url text,
  logo_url text,
  piano text not null check (piano in ('logo', 'partner', 'main')),
  pagato_fino date not null,
  attivo boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists sponsor_richieste (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  piano text not null check (piano in ('logo', 'partner', 'main')),
  messaggio text,
  created_at timestamptz not null default now()
);

alter table sponsors enable row level security;
alter table sponsor_richieste enable row level security;

-- Lettura pubblica solo degli sponsor già pagati e approvati.
drop policy if exists sponsors_lettura_pubblica on sponsors;
create policy sponsors_lettura_pubblica on sponsors
  for select using (attivo = true and pagato_fino >= current_date);

-- Le richieste le inserisce solo il backend (service role).
-- Elenco studi: il client titolare aggiorna le proprie colonne via API admin.

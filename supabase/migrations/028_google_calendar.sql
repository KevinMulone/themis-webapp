-- 028 — Sincronizzazione con Google Calendar
-- STATO: NON ancora applicata.
--
-- Themis resta il calendario vero: colori per tipo, collegamento alla
-- pratica, proposte di scadenza dalle PEC, prenotazioni del portale
-- continuano a vivere solo qui, sulla tabella eventi. Quello che questa
-- migrazione aggiunge è un riflesso in una sola direzione — ogni impegno
-- creato in Themis viene copiato anche sul Google Calendar dello studio
-- — più un'importazione su richiesta per portare dentro Themis ciò che
-- c'era già in quel Google Calendar.
--
-- Due tabelle, come già per pec_account/pec_credenziali: una con i dati
-- che l'interfaccia può leggere (email collegata, calendario, attivo/no),
-- una con il token di aggiornamento OAuth, cifrata e senza NESSUNA
-- policy — leggibile solo dalle route che usano la chiave di servizio.

create table if not exists public.google_calendar_account (
  studio_id uuid primary key references public.studios(id) on delete cascade,
  google_email text not null,
  calendar_id text not null default 'primary',
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_account enable row level security;

create policy google_calendar_account_lettura on public.google_calendar_account
  for select to authenticated
  using (studio_id = public.studio_corrente());

create table if not exists public.google_calendar_credenziali (
  studio_id uuid primary key references public.studios(id) on delete cascade,
  refresh_token_cifrato text not null,
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_credenziali enable row level security;
-- Nessuna policy qui: stesso trattamento di pec_credenziali. Deny-all per
-- authenticated e anon, leggibile solo dal client con service role.

alter table public.eventi
  add column if not exists google_event_id text;

select
  (select count(*) from public.google_calendar_account) as account,
  (select count(*) from public.google_calendar_credenziali) as credenziali,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'eventi' and column_name = 'google_event_id') as colonna_eventi;

-- 019 — PEC: una cartella per volta, con il proprio segnalibro
-- STATO: NON ancora applicata.
--
-- Finora si leggeva solo INBOX e il segnalibro era uno solo, sulla riga
-- dell'account. Per leggere anche le inviate serve un segnalibro per
-- cartella, perché ogni cartella ha la propria numerazione.
--
-- E QUI STA LA TRAPPOLA: gli UID IMAP sono unici DENTRO una cartella, non
-- nella casella. Il vincolo di unicità attuale è su (account, uid): appena
-- si aggiunge una seconda cartella, il messaggio inviato n. 5 verrebbe
-- scartato come doppione del messaggio ricevuto n. 5, e sparirebbe in
-- silenzio. Il vincolo va rifatto includendo la cartella.

create table if not exists public.pec_cartelle (
  id uuid primary key default gen_random_uuid(),
  pec_account_id uuid not null references public.pec_account(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  percorso text not null,
  -- A cosa serve la cartella, per sapere come mostrarne i messaggi.
  ruolo text not null default 'altro' check (ruolo in ('inbox', 'inviata', 'archivio', 'altro')),
  attiva boolean not null default true,
  last_seen_uid bigint not null default 0,
  uid_validity text,
  ultimo_controllo_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pec_account_id, percorso)
);

alter table public.pec_cartelle enable row level security;

drop policy if exists pec_cartelle_studio on public.pec_cartelle;
create policy pec_cartelle_studio on public.pec_cartelle
  for select to authenticated
  using (studio_id = public.studio_corrente());

-- Da quale cartella viene ogni messaggio già archiviato. Il valore di
-- riserva è INBOX perché finora si leggeva solo quella: è vero per tutte
-- le righe esistenti.
alter table public.pec_messaggi
  add column if not exists cartella text not null default 'INBOX';

alter table public.pec_messaggi
  add column if not exists direzione text not null default 'ricevuta';

-- Il vecchio vincolo su (account, uid) non ha un nome che possiamo
-- indovinare da qui: lo si cerca e lo si rimuove per quello che fa.
do $$
declare v_nome text;
begin
  select conname into v_nome
    from pg_constraint
   where conrelid = 'public.pec_messaggi'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) like '%imap_uid%'
     and pg_get_constraintdef(oid) not like '%cartella%'
   limit 1;
  if v_nome is not null then
    execute format('alter table public.pec_messaggi drop constraint %I', v_nome);
  end if;
end $$;

-- Stessa cosa se era un indice unico invece di un vincolo.
do $$
declare v_nome text;
begin
  select indexname into v_nome
    from pg_indexes
   where schemaname = 'public' and tablename = 'pec_messaggi'
     and indexdef like '%UNIQUE%' and indexdef like '%imap_uid%'
     and indexdef not like '%cartella%'
   limit 1;
  if v_nome is not null then
    execute format('drop index public.%I', v_nome);
  end if;
end $$;

create unique index if not exists pec_messaggi_uid_idx
  on public.pec_messaggi (pec_account_id, cartella, imap_uid);

select 'cartelle' as tabella, count(*)::text as righe from public.pec_cartelle
union all
select 'messaggi', count(*)::text from public.pec_messaggi;

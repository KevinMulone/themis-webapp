-- 009 — Incarichi: assegnazione del lavoro e storico
-- STATO: NON ancora applicata.
--
-- Il flusso che serve a Kevin: arriva la pratica, l'avvocato assegna il
-- lavoro a X, X lo prende in carico, lo completa, oppure lo passa a un
-- altro collaboratore o di nuovo all'avvocato. Con la traccia di chi ha
-- fatto cosa e quando — che in uno studio legale non è un vezzo.

create table if not exists public.incarichi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete cascade,
  titolo text not null,
  descrizione text,
  assegnato_a uuid references public.studio_membri(user_id) on delete set null,
  assegnato_da uuid,
  stato text not null default 'da_fare'
    check (stato in ('da_fare', 'in_corso', 'completato', 'annullato')),
  priorita text not null default 'normale'
    check (priorita in ('bassa', 'normale', 'alta', 'urgente')),
  scadenza date,
  created_at timestamptz not null default now(),
  completato_at timestamptz,
  completato_da uuid
);

create index if not exists incarichi_studio_stato_idx on public.incarichi (studio_id, stato);
create index if not exists incarichi_assegnato_idx on public.incarichi (assegnato_a, stato);
create index if not exists incarichi_matter_idx on public.incarichi (matter_id);

-- Storico in sola aggiunta: nessuno lo scrive dal client, lo produce il
-- trigger qui sotto. I nomi sono DENORMALIZZATI di proposito, così la
-- storia resta leggibile anche dopo che un collaboratore è stato rimosso.
create table if not exists public.incarichi_storico (
  id bigint generated always as identity primary key,
  incarico_id uuid not null references public.incarichi(id) on delete cascade,
  studio_id uuid not null,
  azione text not null check (azione in (
    'creato', 'assegnato', 'preso_in_carico', 'passato',
    'completato', 'riaperto', 'annullato', 'modificato'
  )),
  attore_id uuid,
  attore_nome text,
  a_utente uuid,
  a_utente_nome text,
  da_stato text,
  a_stato text,
  created_at timestamptz not null default now()
);

create index if not exists incarichi_storico_idx on public.incarichi_storico (incarico_id, created_at);

alter table public.incarichi enable row level security;
alter table public.incarichi_storico enable row level security;

-- ---------------------------------------------------------------------
-- Nome leggibile di un membro, per lo storico
-- ---------------------------------------------------------------------
create or replace function public.nome_membro(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(m.nome, m.email) from public.studio_membri m where m.user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------
-- Si può assegnare solo a un membro attivo DELLO STESSO studio
-- ---------------------------------------------------------------------
-- Deve stare in un trigger e non in una policy: le policy permissive si
-- sommano in OR, quindi una regola più stretta non potrebbe mai restringere
-- ciò che una policy più larga già permette.
create or replace function public.valida_assegnatario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assegnato_a is not null then
    if not exists (
      select 1 from public.studio_membri m
       where m.user_id = new.assegnato_a
         and m.studio_id = new.studio_id
         and m.stato = 'attivo'
    ) then
      raise exception 'Si può assegnare un incarico solo a un membro attivo dello studio';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_valida_assegnatario on public.incarichi;
create trigger trg_valida_assegnatario
  before insert or update on public.incarichi
  for each row execute function public.valida_assegnatario();

-- ---------------------------------------------------------------------
-- Lo storico lo scrive il database, non l'interfaccia
-- ---------------------------------------------------------------------
-- Due vantaggi: il codice dell'app resta un semplice update, e la traccia
-- non è falsificabile, perché sulla tabella c'è solo il permesso di
-- lettura.
create or replace function public.registra_storico_incarico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attore uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.incarichi_storico
      (incarico_id, studio_id, azione, attore_id, attore_nome, a_utente, a_utente_nome, a_stato)
    values (new.id, new.studio_id,
            case when new.assegnato_a is null then 'creato' else 'assegnato' end,
            attore, public.nome_membro(attore),
            new.assegnato_a, public.nome_membro(new.assegnato_a), new.stato);
    return new;
  end if;

  if new.assegnato_a is distinct from old.assegnato_a then
    insert into public.incarichi_storico
      (incarico_id, studio_id, azione, attore_id, attore_nome, a_utente, a_utente_nome)
    values (new.id, new.studio_id,
            case
              when new.assegnato_a is null then 'modificato'
              when new.assegnato_a = attore then 'preso_in_carico'
              when old.assegnato_a is null then 'assegnato'
              else 'passato'
            end,
            attore, public.nome_membro(attore),
            new.assegnato_a, public.nome_membro(new.assegnato_a));
  end if;

  if new.stato is distinct from old.stato then
    insert into public.incarichi_storico
      (incarico_id, studio_id, azione, attore_id, attore_nome, da_stato, a_stato)
    values (new.id, new.studio_id,
            case new.stato
              when 'completato' then 'completato'
              when 'annullato' then 'annullato'
              else case when old.stato = 'completato' then 'riaperto' else 'modificato' end
            end,
            attore, public.nome_membro(attore), old.stato, new.stato);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_storico_incarico on public.incarichi;
create trigger trg_storico_incarico
  after insert or update on public.incarichi
  for each row execute function public.registra_storico_incarico();

-- ---------------------------------------------------------------------
-- Eliminare un incarico è cosa del titolare
-- ---------------------------------------------------------------------
create or replace function public.solo_titolare_elimina_incarico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.e_titolare() then
    raise exception 'Solo il titolare dello studio può eliminare un incarico';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_elimina_incarico on public.incarichi;
create trigger trg_elimina_incarico
  before delete on public.incarichi
  for each row execute function public.solo_titolare_elimina_incarico();

-- ---------------------------------------------------------------------
-- Accesso
-- ---------------------------------------------------------------------
drop policy if exists membri_incarichi on public.incarichi;
create policy membri_incarichi on public.incarichi
  for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (studio_id = public.studio_corrente());

-- Sullo storico solo lettura: è una traccia, non un registro modificabile.
drop policy if exists membri_incarichi_storico on public.incarichi_storico;
create policy membri_incarichi_storico on public.incarichi_storico
  for select to authenticated
  using (studio_id = public.studio_corrente());

-- ---------------------------------------------------------------------
-- Responsabile della pratica, distinto dai singoli incarichi
-- ---------------------------------------------------------------------
alter table public.matters
  add column if not exists assegnato_a uuid references public.studio_membri(user_id) on delete set null;

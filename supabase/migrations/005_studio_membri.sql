-- 005 — Collaboratori: tabella dei membri e risolutore di appartenenza
-- STATO: NON ancora applicata.
-- PREREQUISITO: eseguire prima 000_diagnostica_sola_lettura.sql e fare un
-- backup del database.
--
-- Perché serve
-- ------------
-- Oggi tutta l'app assume "un utente = uno studio": studios.id È l'id
-- dell'utente Supabase Auth. Per far entrare un collaboratore — che ha un
-- id proprio, diverso da quello dello studio — l'app deve smettere di
-- chiedersi "chi sono io" e iniziare a chiedersi "a quale studio
-- appartengo".
--
-- Questa migrazione introduce quella domanda senza cambiare la risposta
-- per chi c'è già: per un titolare studio_corrente() vale esattamente
-- auth.uid(), quindi tutto continua a funzionare identico. Nessuna
-- migrazione di dati, nessuna ri-cifratura di file.
--
-- Le policy che aprono i dati ai collaboratori sono nella 006, separate
-- apposta: la loro forma dipende dall'esito della diagnostica.

-- ---------------------------------------------------------------------
-- La rosa dello studio
-- ---------------------------------------------------------------------
create table if not exists public.studio_membri (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,

  -- Nullo finché l'invito non viene accettato (a quel punto si crea
  -- l'utente Auth e lo si collega qui).
  -- UNIQUE a livello globale, non per studio: una persona appartiene al
  -- massimo a uno studio. È questo vincolo che rende studio_corrente()
  -- una funzione scalare, senza ambiguità su "quale studio".
  user_id uuid unique references auth.users(id) on delete set null,

  email text not null,
  nome text,
  ruolo text not null default 'collaboratore'
    check (ruolo in ('titolare', 'collaboratore')),
  stato text not null default 'invitato'
    check (stato in ('invitato', 'attivo', 'disattivato')),

  invite_code text unique,
  invito_scade_at timestamptz,
  invitato_da uuid,

  created_at timestamptz not null default now(),
  attivato_at timestamptz,
  disattivato_at timestamptz
);

create index if not exists studio_membri_studio_idx
  on public.studio_membri (studio_id, stato);

create unique index if not exists studio_membri_email_studio_idx
  on public.studio_membri (studio_id, lower(email));

alter table public.studio_membri enable row level security;

-- ATTENZIONE, da non fare mai su questa tabella:
--   alter table public.studio_membri force row level security;
-- studio_corrente() la legge in SECURITY DEFINER e la policy di lettura
-- chiama a sua volta studio_corrente(): con FORCE si otterrebbe una
-- ricorsione infinita.

-- ---------------------------------------------------------------------
-- Il risolutore
-- ---------------------------------------------------------------------
-- L'APPARTENENZA SI RISOLVE PRIMA DELLA PROPRIETÀ. Un collaboratore ha
-- quasi certamente una riga studios "orfana", creata dal trigger su
-- auth.users al momento della registrazione: risolvere prima la proprietà
-- lo manderebbe nel proprio studio vuoto invece che in quello del suo
-- titolare.
--
-- Il "and s.plan is not null" nel ramo di riserva è una seconda rete di
-- sicurezza: una riga orfana ha sempre plan nullo (lo valorizzano solo
-- redeem_license e api/admin/create-studio), quindi non viene mai scelta.
create or replace function public.studio_corrente()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.studio_id
       from public.studio_membri m
      where m.user_id = auth.uid() and m.stato = 'attivo'
      limit 1),
    (select s.id
       from public.studios s
      where s.id = auth.uid() and s.plan is not null)
  );
$$;

create or replace function public.ruolo_corrente()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.ruolo
       from public.studio_membri m
      where m.user_id = auth.uid() and m.stato = 'attivo'
      limit 1),
    (select 'titolare'
       from public.studios s
      where s.id = auth.uid() and s.plan is not null),
    'nessuno'
  );
$$;

create or replace function public.e_titolare()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ruolo_corrente() = 'titolare';
$$;

-- Contesto completo in una sola chiamata: il layout dell'app fa già oggi
-- esattamente una query per sapere nome studio e stato abbonamento, e
-- deve continuare a farne una sola.
--
-- Nota sui casi limite, che replicano il comportamento attuale:
--  - utente senza studio, o studio senza piano  -> nessuna riga -> /attiva
--  - studio sospeso o scaduto -> riga restituita, il gate lo fa l'app
create or replace function public.contesto_studio()
returns table (
  studio_id uuid,
  ruolo text,
  nome_studio text,
  plan text,
  subscription_status text,
  subscription_expires_at date
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
         public.ruolo_corrente(),
         s.nome_studio,
         s.plan,
         s.subscription_status,
         s.subscription_expires_at
    from public.studios s
   where s.id = public.studio_corrente();
$$;

revoke all on function
  public.studio_corrente(),
  public.ruolo_corrente(),
  public.e_titolare(),
  public.contesto_studio()
from public;

grant execute on function
  public.studio_corrente(),
  public.ruolo_corrente(),
  public.e_titolare(),
  public.contesto_studio()
to authenticated;

-- ---------------------------------------------------------------------
-- Popolamento iniziale: ogni studio esistente diventa il titolare di sé
-- stesso.
--
-- Il risolutore non ne ha bisogno (il ramo di riserva copre già i
-- titolari), ma serve perché la rosa sia completa nell'interfaccia e
-- perché incarichi.assegnato_a possa puntare anche al titolare.
-- ---------------------------------------------------------------------
insert into public.studio_membri (studio_id, user_id, email, nome, ruolo, stato, attivato_at)
select s.id, s.id, u.email, s.nome_studio, 'titolare', 'attivo', now()
  from public.studios s
  join auth.users u on u.id = s.id
 where s.plan is not null
on conflict (user_id) do nothing;

-- Lettura della propria rosa: serve alla tendina "assegna a" e alla
-- pagina Collaboratori. Nessuna policy di scrittura, di proposito: ogni
-- modifica passa dalle route API con la service role key, dopo aver
-- verificato ruolo e posti disponibili.
create policy membri_rosa_select on public.studio_membri
  for select to authenticated
  using (studio_id = public.studio_corrente());

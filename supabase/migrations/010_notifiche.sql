-- 010 — Notifiche e registro attività dello studio
-- STATO: NON ancora applicata.
--
-- Le notifiche le scrivono i TRIGGER, non l'interfaccia. Stessa ragione
-- dello storico degli incarichi: funzionano qualunque sia la strada da cui
-- arriva l'azione (app, portale clienti, route API, generazione atti in
-- Python), e nessuno può fabbricarle dal browser perché sulla tabella non
-- esiste il permesso di inserimento.
--
-- destinatario_id nullo = "riguarda lo studio", non una persona precisa:
-- sono le attività che vede il titolare nella scheda dedicata.

create table if not exists public.notifiche (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios(id) on delete cascade,
  destinatario_id uuid,
  tipo text not null,
  testo text not null,
  link text,
  attore_nome text,
  -- Serve solo a impedire doppioni per le notifiche generate a posteriori
  -- (le scadenze): per tutte le altre resta nulla.
  chiave_unicita text,
  letta_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifiche_destinatario_idx
  on public.notifiche (destinatario_id, letta_at, created_at desc);
create index if not exists notifiche_studio_idx
  on public.notifiche (studio_id, created_at desc);
create unique index if not exists notifiche_chiave_idx
  on public.notifiche (studio_id, chiave_unicita) where chiave_unicita is not null;

alter table public.notifiche enable row level security;

-- Ognuno vede le proprie; il titolare vede tutto ciò che accade nello
-- studio. Nessun permesso di inserimento: le scrivono solo i trigger.
drop policy if exists notifiche_lettura on public.notifiche;
create policy notifiche_lettura on public.notifiche
  for select to authenticated
  using (
    studio_id = public.studio_corrente()
    and (destinatario_id = auth.uid() or public.e_titolare())
  );

-- Aggiornamento consentito solo per segnare "letta".
drop policy if exists notifiche_segna_letta on public.notifiche;
create policy notifiche_segna_letta on public.notifiche
  for update to authenticated
  using (
    studio_id = public.studio_corrente()
    and (destinatario_id = auth.uid() or public.e_titolare())
  )
  with check (studio_id = public.studio_corrente());

-- ---------------------------------------------------------------------
-- Scrittura di una notifica
-- ---------------------------------------------------------------------
create or replace function public.crea_notifica(
  p_studio_id uuid, p_destinatario uuid, p_tipo text,
  p_testo text, p_link text, p_chiave text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifiche
    (studio_id, destinatario_id, tipo, testo, link, attore_nome, chiave_unicita)
  values
    (p_studio_id, p_destinatario, p_tipo, p_testo, p_link,
     public.nome_membro(auth.uid()), p_chiave)
  on conflict do nothing;
end;
$$;

-- Descrizione breve di una pratica, per i testi delle notifiche.
create or replace function public.etichetta_pratica(p_matter_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(coalesce(c.cognome, '') || ' ' || coalesce(c.nome, '')), ''),
    c.ragione_sociale,
    'pratica'
  )
  from public.matters m
  left join public.clients c on c.id = m.client_id
  where m.id = p_matter_id;
$$;

-- ---------------------------------------------------------------------
-- Incarichi: assegnazione, passaggio, completamento
-- ---------------------------------------------------------------------
create or replace function public.notifica_incarico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attore uuid := auth.uid();
begin
  -- Assegnato o passato a qualcun altro (non a sé stessi: prendere in
  -- carico un proprio incarico non è una notizia per nessuno).
  if new.assegnato_a is not null
     and new.assegnato_a is distinct from attore
     and (tg_op = 'INSERT' or new.assegnato_a is distinct from old.assegnato_a) then
    perform public.crea_notifica(
      new.studio_id, new.assegnato_a, 'incarico_assegnato',
      coalesce(public.nome_membro(attore), 'Lo studio') || ' ti ha assegnato: ' || new.titolo,
      '/incarichi'
    );
  end if;

  -- Completato: lo sa chi lo aveva assegnato.
  if tg_op = 'UPDATE'
     and new.stato = 'completato' and old.stato is distinct from 'completato'
     and new.assegnato_da is not null and new.assegnato_da is distinct from attore then
    perform public.crea_notifica(
      new.studio_id, new.assegnato_da, 'incarico_completato',
      coalesce(public.nome_membro(attore), 'Qualcuno') || ' ha completato: ' || new.titolo,
      '/incarichi'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notifica_incarico on public.incarichi;
create trigger trg_notifica_incarico
  after insert or update on public.incarichi
  for each row execute function public.notifica_incarico();

-- ---------------------------------------------------------------------
-- Cancellazioni: riservate al titolare, e registrate
-- ---------------------------------------------------------------------
-- La restrizione mancava: finora un collaboratore poteva eliminare
-- pratiche e clienti, contrariamente a quanto stabilito. Va in un trigger
-- e non in una policy perché le policy permissive si sommano in OR: una
-- regola più stretta non potrebbe restringere ciò che una più larga
-- già permette.
create or replace function public.solo_titolare_elimina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.e_titolare() then
    raise exception 'Solo il titolare dello studio può eliminare definitivamente';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_elimina_matter on public.matters;
create trigger trg_elimina_matter before delete on public.matters
  for each row execute function public.solo_titolare_elimina();

drop trigger if exists trg_elimina_client on public.clients;
create trigger trg_elimina_client before delete on public.clients
  for each row execute function public.solo_titolare_elimina();

drop trigger if exists trg_elimina_documento on public.documenti;
create trigger trg_elimina_documento before delete on public.documenti
  for each row execute function public.solo_titolare_elimina();

create or replace function public.notifica_eliminazione()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  descrizione text;
begin
  descrizione := case tg_table_name
    when 'matters' then 'la pratica di ' || coalesce(public.etichetta_pratica(old.id), '—')
    when 'clients' then 'il cliente ' || coalesce(
      nullif(trim(coalesce(old.cognome, '') || ' ' || coalesce(old.nome, '')), ''),
      old.ragione_sociale, '—')
    when 'documenti' then 'il documento ' || coalesce(old.nome_file, '—')
    else 'un elemento'
  end;

  perform public.crea_notifica(
    old.studio_id, null, 'eliminazione',
    coalesce(public.nome_membro(auth.uid()), 'Qualcuno') || ' ha eliminato ' || descrizione,
    null
  );
  return old;
end;
$$;

drop trigger if exists trg_notifica_elim_matter on public.matters;
create trigger trg_notifica_elim_matter before delete on public.matters
  for each row execute function public.notifica_eliminazione();

drop trigger if exists trg_notifica_elim_client on public.clients;
create trigger trg_notifica_elim_client before delete on public.clients
  for each row execute function public.notifica_eliminazione();

drop trigger if exists trg_notifica_elim_documento on public.documenti;
create trigger trg_notifica_elim_documento before delete on public.documenti
  for each row execute function public.notifica_eliminazione();

-- ---------------------------------------------------------------------
-- Dal portale clienti
-- ---------------------------------------------------------------------
create or replace function public.notifica_prenotazione()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crea_notifica(
    new.studio_id, null, 'prenotazione',
    coalesce(new.nome_cliente, 'Un cliente') || ' ha prenotato un appuntamento il '
      || to_char(new.data, 'DD/MM') || ' alle ' || to_char(new.ora_inizio, 'HH24:MI'),
    '/calendario'
  );
  return new;
end;
$$;

drop trigger if exists trg_notifica_prenotazione on public.appointments;
create trigger trg_notifica_prenotazione after insert on public.appointments
  for each row execute function public.notifica_prenotazione();

create or replace function public.notifica_documento_caricato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stato = 'caricato' and old.stato is distinct from 'caricato' then
    perform public.crea_notifica(
      new.studio_id, null, 'documento_cliente',
      'Il cliente ha caricato: ' || new.titolo,
      '/pratiche/' || new.matter_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifica_documento_caricato on public.document_requests;
create trigger trg_notifica_documento_caricato after update on public.document_requests
  for each row execute function public.notifica_documento_caricato();

-- ---------------------------------------------------------------------
-- PEC: solo i messaggi veri, non le ricevute
-- ---------------------------------------------------------------------
create or replace function public.notifica_pec()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_pec = 'posta-certificata' then
    perform public.crea_notifica(
      new.studio_id, null, 'pec',
      'Nuova PEC da ' || coalesce(new.mittente, 'mittente sconosciuto'),
      '/pec'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifica_pec on public.pec_messaggi;
create trigger trg_notifica_pec after insert on public.pec_messaggi
  for each row execute function public.notifica_pec();

-- ---------------------------------------------------------------------
-- Scadenze in arrivo
-- ---------------------------------------------------------------------
-- Non c'è un evento a cui agganciare un trigger: una scadenza "si avvicina"
-- da sola, col passare del tempo. Invece di dipendere da un lavoro
-- programmato sul server (che oggi non è configurato), le notifiche si
-- generano quando qualcuno apre le notifiche. L'indice unico su
-- chiave_unicita fa sì che rieseguirla non crei doppioni.
create or replace function public.genera_notifiche_scadenze()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  studio uuid := public.studio_corrente();
  ev record;
begin
  if studio is null then return; end if;

  for ev in
    select id, titolo, data
      from public.eventi
     where studio_id = studio
       and tipo in ('udienza', 'termine_processuale', 'scadenza')
       and data between current_date and current_date + 3
  loop
    perform public.crea_notifica(
      studio, null, 'scadenza',
      ev.titolo || ' — ' || case
        when ev.data = current_date then 'oggi'
        when ev.data = current_date + 1 then 'domani'
        else 'il ' || to_char(ev.data, 'DD/MM')
      end,
      '/calendario',
      'scadenza:' || ev.id
    );
  end loop;
end;
$$;

revoke all on function public.genera_notifiche_scadenze() from public;
grant execute on function public.genera_notifiche_scadenze() to authenticated;

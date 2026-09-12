-- 038 — Corregge l'eliminazione di clienti/pratiche/documenti e la versione dei documenti
--
-- Trovati entrambi testando l'app come farebbe un avvocato (13.09.2026).
--
-- 1) notifica_eliminazione() (migrazione 010) leggeva old.nome_file / old.cognome /
--    old.nome / old.ragione_sociale direttamente su OLD, che in un trigger condiviso
--    fra più tabelle è di tipo RECORD: PL/pgSQL verifica l'esistenza del campo sul
--    tipo di riga reale anche nei rami del CASE non presi. Risultato: eliminare un
--    cliente, una pratica o un documento falliva sempre con un errore tecnico
--    ("record \"old\" has no field ..."), senza alcun messaggio comprensibile in UI.
--    Corretto leggendo i campi da to_jsonb(old), che su una chiave assente
--    restituisce NULL invece di sollevare un errore.
--
-- 2) La versione dei documenti (colonna aggiunta dalla 037) veniva calcolata in
--    src/app/api/documenti/upload/route.ts con un COUNT lato client prima
--    dell'insert: oltre a non restituire il conteggio corretto per nome file in
--    produzione, resta comunque soggetto a race condition fra upload concorrenti.
--    Spostato il calcolo in un trigger, atomico e sempre corretto: la versione è
--    sempre "quante volte è già stato caricato un file con questo nome in questa
--    pratica, più uno", calcolata lato database indipendentemente da chi chiama.

create or replace function public.notifica_eliminazione()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  descrizione text;
  riga jsonb := to_jsonb(old);
begin
  descrizione := case tg_table_name
    when 'matters' then 'la pratica di ' || coalesce(public.etichetta_pratica(old.id), '—')
    when 'clients' then 'il cliente ' || coalesce(
      nullif(trim(coalesce(riga->>'cognome', '') || ' ' || coalesce(riga->>'nome', '')), ''),
      riga->>'ragione_sociale', '—')
    when 'documenti' then 'il documento ' || coalesce(riga->>'nome_file', '—')
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

-- Calcola la versione del documento lato database: sempre corretta, sempre
-- atomica anche con upload concorrenti dello stesso nome file (il lock
-- serializza solo gli inserimenti con la stessa coppia pratica+nome file,
-- non l'intera tabella).
create or replace function public.imposta_versione_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.matter_id::text || '|' || coalesce(new.nome_file, ''), 0));
  select coalesce(max(versione), 0) + 1 into new.versione
  from public.documenti
  where matter_id = new.matter_id and nome_file = new.nome_file;
  return new;
end;
$$;

drop trigger if exists trg_versione_documento on public.documenti;
create trigger trg_versione_documento before insert on public.documenti
  for each row execute function public.imposta_versione_documento();

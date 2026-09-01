-- 025 — Le proposte non sono tutte udienze
-- STATO: NON ancora applicata.
--
-- Il vincolo ammetteva pochi valori, e tutto ciò che non era un termine
-- finiva marcato "udienza": una visita medico-legale davanti al CTU
-- diventava un'udienza in calendario. In un'agenda legale la differenza
-- non è formale — un'udienza si rinvia dal giudice, una visita si sposta
-- con il consulente.

alter table public.pec_proposte
  drop constraint if exists pec_proposte_tipo_proposto_check;

alter table public.pec_proposte
  add constraint pec_proposte_tipo_proposto_check
  check (tipo_proposto = any (array[
    'udienza',       -- comparizione davanti al giudice
    'ctu',           -- visita o operazioni peritali
    'termine',       -- termine processuale da rispettare
    'scadenza',      -- scadenza non processuale
    'appuntamento',  -- incontro, mediazione, negoziazione
    'altro'
  ]::text[]));

select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.pec_proposte'::regclass and contype = 'c';

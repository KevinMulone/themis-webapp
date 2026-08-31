-- 014 — Stili di riferimento per la redazione degli atti
-- STATO: NON ancora applicata.
--
-- Gli atti non seguono più una struttura scritta nel codice: seguono lo
-- scheletro degli atti veri dello studio.
--
-- IMPORTANTE — qui dentro NON finiscono atti. Finisce lo *scheletro*:
-- sezioni, ordine, formule di rito, registro. Ogni nome, data, importo,
-- codice fiscale e numero di ruolo è già stato sostituito da un
-- segnaposto prima di arrivare qui. La ragione è pratica prima che
-- giuridica: un atto vero messo accanto al fascicolo nuovo finisce, prima
-- o poi, per travasare un dato del cliente sbagliato dentro l'atto del
-- cliente giusto. Lo scheletro non può farlo, perché non contiene dati.

create table if not exists public.stili_atto (
  id uuid primary key default gen_random_uuid(),
  -- NULL = stile di sistema, disponibile a tutti gli studi.
  -- Valorizzato = stile privato di quello studio.
  -- Stessa convenzione già usata da public.templates.
  studio_id uuid references public.studios(id) on delete cascade,
  tipo text not null,
  nome text not null,
  scheletro text not null,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists stili_atto_tipo_idx on public.stili_atto (tipo, attivo);

alter table public.stili_atto enable row level security;

-- Si leggono gli stili di sistema e i propri. La scrittura passa solo
-- dalle route con la chiave di servizio.
drop policy if exists stili_atto_lettura on public.stili_atto;
create policy stili_atto_lettura on public.stili_atto
  for select to authenticated
  using (studio_id is null or studio_id = public.studio_corrente());

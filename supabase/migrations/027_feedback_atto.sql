-- 027 — Il riscontro su ogni bozza generata da Themis
-- STATO: NON ancora applicata.
--
-- Dopo ogni bozza, si chiede: è andata bene? Se sì, non c'è nulla da
-- correggere — un pregio non è un'istruzione. Se no, si chiede cosa
-- cambiare, e quella nota (le parole dell'avvocato, non l'atto) viene
-- riproposta nel prompt la volta successiva per lo stesso tipo di atto
-- nello stesso studio.
--
-- Non finisce mai qui il testo dell'atto generato: conterrebbe nome,
-- codice fiscale e fatti del cliente, e la regola di questo progetto
-- (vedi 014_stili_atto.sql) è che nulla di un fascicolo deve poter
-- comparire nella bozza di un altro. La nota di correzione è invece
-- una preferenza di stile o di struttura scritta dall'avvocato stesso:
-- "manca la data di notifica nelle premesse", non un fatto di causa.

create table if not exists public.atto_feedback (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  tipo_atto text not null,
  buono boolean not null,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists atto_feedback_studio_tipo_idx
  on public.atto_feedback (studio_id, tipo_atto, created_at desc);

alter table public.atto_feedback enable row level security;

create policy atto_feedback_rw on public.atto_feedback
  for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (studio_id = public.studio_corrente());

select count(*) from public.atto_feedback;

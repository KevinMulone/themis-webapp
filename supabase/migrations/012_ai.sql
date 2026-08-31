-- 012 — Intelligenza artificiale: consumo e tetto di spesa
-- STATO: NON ancora applicata.
--
-- Il tetto di spesa si costruisce PRIMA delle funzioni che spendono, non
-- dopo: senza, un errore o un uso intenso genera un conto a sorpresa.
--
-- Riguarda solo il conteggio del consumo. Le proposte di scadenza estratte
-- dalle PEC arriveranno in una migrazione successiva: la tabella
-- pec_proposte esiste già ma non è mai stata usata dal codice, e prima di
-- scriverci dentro vanno guardate le sue colonne vere invece di dedurle.

create table if not exists public.ai_utilizzo (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios(id) on delete cascade,
  -- Primo giorno del mese di riferimento, per sommare senza ambiguità di
  -- fuso orario.
  mese date not null,
  funzione text not null,
  token_input bigint not null default 0,
  token_output bigint not null default 0,
  -- Millesimi di euro: i centesimi perderebbero troppa precisione, visto
  -- che una singola richiesta può costare frazioni di centesimo.
  costo_millesimi integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_utilizzo_studio_mese_idx
  on public.ai_utilizzo (studio_id, mese);

alter table public.ai_utilizzo enable row level security;

-- Ognuno vede il consumo del proprio studio; scrive solo il server con la
-- chiave di servizio, mai il browser.
drop policy if exists ai_utilizzo_lettura on public.ai_utilizzo;
create policy ai_utilizzo_lettura on public.ai_utilizzo
  for select to authenticated
  using (studio_id = public.studio_corrente());

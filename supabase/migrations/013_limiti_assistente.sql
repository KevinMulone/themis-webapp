-- 013 — Limite mensile dell'assistente, regolabile dal pannello admin
-- STATO: NON ancora applicata. Va eseguita insieme alla 012.
--
-- Il credito mensile era una costante nel codice: cambiarlo richiedeva una
-- pubblicazione. Passa nel database, così Kevin lo regola dal pannello
-- mentre osserva il consumo reale.

create table if not exists public.limiti_assistente (
  plan text primary key,
  -- Centesimi di DOLLARO al mese, per studio: è la valuta in cui fattura
  -- Anthropic e in cui si ricarica il credito. Convertire in euro con un
  -- cambio fisso mostrerebbe un consumo che non torna mai con la console.
  credito_cent integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.limiti_assistente (plan, credito_cent) values
  ('monthly', 500),
  ('semestrale', 1000),
  ('annuale', 2000)
on conflict (plan) do nothing;

alter table public.limiti_assistente enable row level security;

-- Lettura aperta a chi è autenticato: è il limite del proprio piano, non
-- un dato riservato, e serve a mostrare "credito residuo" in interfaccia.
-- La scrittura passa solo dalla route admin con la chiave di servizio.
drop policy if exists limiti_assistente_lettura on public.limiti_assistente;
create policy limiti_assistente_lettura on public.limiti_assistente
  for select to authenticated using (true);

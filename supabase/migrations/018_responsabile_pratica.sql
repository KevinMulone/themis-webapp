-- 018 — Responsabile della pratica
-- STATO: NON ancora applicata.
--
-- Fino a oggi si sapeva a chi era assegnato un singolo incarico, non a chi
-- fosse affidata la pratica nel suo insieme. Sono due cose diverse: gli
-- incarichi vanno e vengono, il responsabile resta ed è quello che serve
-- vedere nell'elenco.
--
-- Nessun vincolo di obbligatorietà: una pratica senza responsabile è
-- normale, soprattutto in uno studio di una persona sola.

alter table public.matters
  add column if not exists assegnato_a uuid
  references public.studio_membri(user_id) on delete set null;

create index if not exists matters_assegnato_idx on public.matters (assegnato_a);

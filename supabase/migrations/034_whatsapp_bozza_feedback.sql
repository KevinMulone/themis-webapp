-- 034 — Il riscontro sulle bozze di risposta WhatsApp
-- STATO: NON ancora applicata.
--
-- Stesso meccanismo già in produzione per le bozze di atti (027): dopo
-- ogni bozza generata da Themis per rispondere su WhatsApp, si chiede
-- "è andata bene?". Un "sì" non produce nulla da riproporre — un pregio
-- non è un'istruzione. Un "no" con una nota entra nel prompt delle
-- bozze WhatsApp successive per lo stesso studio.
--
-- Nessun matter_id o tipo, a differenza di atto_feedback: le risposte
-- WhatsApp non sono divise per "tipo di atto", sono tutte la stessa
-- cosa (una risposta breve a un cliente), quindi il riscontro vale per
-- l'intero studio, non per una categoria dentro di esso.

create table if not exists public.whatsapp_bozza_feedback (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  buono boolean not null,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_bozza_feedback_studio_idx
  on public.whatsapp_bozza_feedback (studio_id, created_at desc);

alter table public.whatsapp_bozza_feedback enable row level security;

create policy whatsapp_bozza_feedback_rw on public.whatsapp_bozza_feedback
  for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (studio_id = public.studio_corrente());

select count(*) from public.whatsapp_bozza_feedback;

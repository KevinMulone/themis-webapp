-- 001 — Collegamento a Stripe per gli abbonamenti
-- STATO: già applicata (agosto 2026). Ricostruita a posteriori.
--
-- Collega lo studio al cliente/abbonamento Stripe. Il collegamento si
-- stabilisce al momento del riscatto della prima chiave di licenza
-- (src/app/api/activate/route.ts), perché al momento del pagamento lo
-- studio potrebbe non esistere ancora: chi paga può non essersi ancora
-- registrato.

alter table studios
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique;

-- Le chiavi generate dal webhook portano con sé gli id Stripe, così al
-- riscatto si sa a quale cliente Stripe appartiene lo studio.
alter table issued_licenses
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- Idempotenza dei webhook: Stripe può reinviare lo stesso evento più
-- volte (retry automatici). Senza questa tabella un rinnovo potrebbe
-- allungare l'abbonamento due volte.
create table if not exists stripe_webhook_events (
  id text primary key,           -- Stripe event.id, es. "evt_..."
  type text not null,
  received_at timestamptz not null default now()
);

-- RLS attiva e nessuna policy: solo la service role key (che bypassa RLS)
-- può leggerla o scriverla. Nessun client, mai.
alter table stripe_webhook_events enable row level security;

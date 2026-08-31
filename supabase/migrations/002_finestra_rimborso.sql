-- 002 — Garanzia di rimborso entro 4 giorni
-- STATO: già applicata (agosto 2026). Ricostruita a posteriori.
--
-- subscription_started_at: quando l'abbonamento Stripe è stato attivato
--   per la prima volta (scritto al riscatto della prima chiave). È da qui
--   che si contano i 4 giorni della garanzia di rimborso.
-- refund_requested_at: quando il cliente ha premuto "Chiedi il rimborso".
--   Valorizzato una sola volta; la richiesta sospende immediatamente
--   l'account (subscription_status = 'suspended').

alter table studios
  add column if not exists subscription_started_at timestamptz,
  add column if not exists refund_requested_at timestamptz;

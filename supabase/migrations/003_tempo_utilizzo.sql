-- 003 — Tempo di utilizzo reale dell'app, per studio
-- STATO: già applicata (agosto 2026). Ricostruita a posteriori.
--
-- Alimentata da src/app/api/usage-heartbeat/route.ts, chiamata ogni 60
-- secondi da UsageTracker mentre la scheda del browser è visibile. Ogni
-- chiamata vale sempre 60 secondi fissi: non ci si fida di un "tempo
-- trascorso" calcolato dal client, che sarebbe sbagliato dopo una
-- sospensione del computer. È una stima per il pannello amministratore,
-- non un dato di fatturazione.

alter table studios
  add column if not exists tempo_utilizzo_secondi bigint not null default 0;

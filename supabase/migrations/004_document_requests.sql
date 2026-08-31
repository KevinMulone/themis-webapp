-- 004 — Richiesta documenti al cliente tramite il portale
-- STATO: già applicata (agosto 2026). Ricostruita a posteriori.
--
-- Lo studio chiede un documento specifico al cliente su una pratica; il
-- cliente lo carica dal portale (/portale) e il file compare da solo tra
-- i documenti della pratica.
--
-- client_id è salvato in chiaro sulla riga (copiato da matters.client_id
-- alla creazione) apposta: rende la policy del cliente semplice e
-- autosufficiente, senza dipendere dalla struttura di portal_clients.

create table if not exists document_requests (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  matter_id uuid not null references matters(id) on delete cascade,
  client_id uuid not null,
  titolo text not null,
  note text,
  stato text not null default 'in_attesa',
  documento_id uuid references documenti(id),
  created_at timestamptz not null default now(),
  caricato_at timestamptz
);

alter table document_requests enable row level security;

create policy "Studio gestisce le proprie richieste"
  on document_requests for all
  using (studio_id = auth.uid())
  with check (studio_id = auth.uid());

-- Il cliente del portale risale al proprio client_id tramite l'invito che
-- ha usato per registrarsi: portal_invites.email combacia con l'email
-- dell'utente autenticato.
create policy "Cliente del portale vede le proprie richieste"
  on document_requests for select
  using (
    client_id = (
      select pi.client_id from portal_invites pi
      join auth.users u on u.email = pi.email
      where u.id = auth.uid() and pi.used = true
      limit 1
    )
  );

-- 030 — WhatsApp: numero collegato, messaggi, proposte
-- STATO: NON ancora applicata.
--
-- Stesso schema già in produzione per le PEC (messaggio → l'IA propone
-- una scadenza → il difensore accetta o scarta), applicato a un secondo
-- canale. Tabelle NUOVE e non un campo "canale" su pec_proposte, di
-- proposito: pec_proposte è codice toccato ogni giorno dagli avvocati, e
-- WhatsApp qui arriva con una libreria non ufficiale (vedi nota nel
-- codice del servizio esterno) che può smettere di funzionare da un
-- giorno all'altro. Tenerle separate significa che un problema di
-- WhatsApp non tocca le PEC, e che si può disattivare o rimuovere questa
-- funzione senza toccare l'altra.
--
-- Nessuna tabella di credenziali: il servizio esterno che tiene aperta
-- la connessione WhatsApp conserva le proprie credenziali di sessione sul
-- proprio disco, non su Supabase, e non riceve mai la chiave di cifratura
-- di Themis — solo un segreto condiviso per autenticare le chiamate HTTP
-- reciproche (variabile d'ambiente WHATSAPP_WORKER_SECRET, mai in questo
-- database).

create table if not exists public.whatsapp_account (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  numero_telefono text,
  stato_connessione text not null default 'disconnesso'
    check (stato_connessione in ('disconnesso', 'in_attesa_qr', 'connesso')),
  connesso_il timestamptz,
  aggiornato_il timestamptz not null default now(),
  unique (studio_id)
);

alter table public.whatsapp_account enable row level security;

create policy whatsapp_account_lettura on public.whatsapp_account
  for select to authenticated using (studio_id = public.studio_corrente());

-- Il numero collegato è una scelta che riguarda tutto lo studio: come per
-- l'account PEC, solo il titolare lo collega o lo scollega. Le scritture
-- vere passano comunque dalle route con la chiave di servizio (il
-- servizio esterno non ha una sessione Supabase); questa policy serve a
-- chi, per errore o per test, provasse a scrivere con il client normale.
create policy whatsapp_account_scrittura_titolare on public.whatsapp_account
  for all to authenticated
  using (studio_id = public.studio_corrente() and public.e_titolare())
  with check (studio_id = public.studio_corrente() and public.e_titolare());

create table if not exists public.whatsapp_messaggi (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  -- L'id che WhatsApp assegna al messaggio: evita di salvare due volte lo
  -- stesso messaggio se il servizio esterno lo consegna due volte (può
  -- succede dopo un riavvio, con la coda di riconsegna di Baileys).
  wa_message_id text not null,
  jid_mittente text not null,
  numero_normalizzato text,
  cliente_id uuid references public.clients(id) on delete set null,
  matter_id uuid references public.matters(id) on delete set null,
  -- Cifrato come un documento: sono comunicazioni riservate con un
  -- cliente, la stessa categoria delle PEC. encryptBuffer(testo, studio_id),
  -- salvato in base64 — stessa convenzione già usata per il refresh token
  -- di Google Calendar (colonna text, non bytea).
  testo_cifrato text not null,
  direzione text not null check (direzione in ('in', 'out')),
  stato_match text not null default 'non_riconosciuto'
    check (stato_match in ('abbinato', 'non_riconosciuto')),
  analizzato boolean not null default false,
  ricevuto_il timestamptz not null default now(),
  unique (studio_id, wa_message_id)
);

create index if not exists whatsapp_messaggi_studio_idx
  on public.whatsapp_messaggi (studio_id, ricevuto_il desc);

alter table public.whatsapp_messaggi enable row level security;

create policy whatsapp_messaggi_lettura on public.whatsapp_messaggi
  for select to authenticated using (studio_id = public.studio_corrente());

-- Nessuna policy di scrittura per gli utenti autenticati: i messaggi
-- arrivano solo dallo webhook del servizio esterno e vengono aggiornati
-- solo dalle route di analisi/abbinamento, tutte con la chiave di
-- servizio. Un avvocato non deve poter scrivere un messaggio "in arrivo"
-- che non è mai arrivato.

create table if not exists public.whatsapp_proposte (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  messaggio_id uuid not null references public.whatsapp_messaggi(id) on delete cascade,
  matter_id uuid references public.matters(id) on delete set null,
  tipo_proposto text not null check (tipo_proposto in
    ('udienza', 'ctu', 'termine', 'scadenza', 'appuntamento', 'altro')),
  data_proposta date not null,
  ora_proposta text,
  titolo_proposto text not null,
  estratto text,
  confidenza text not null default 'bassa' check (confidenza in ('alta', 'bassa')),
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'accettata', 'rifiutata')),
  evento_id uuid references public.eventi(id) on delete set null,
  creata_il timestamptz not null default now()
);

create index if not exists whatsapp_proposte_studio_stato_idx
  on public.whatsapp_proposte (studio_id, stato);

alter table public.whatsapp_proposte enable row level security;

create policy whatsapp_proposte_lettura on public.whatsapp_proposte
  for select to authenticated using (studio_id = public.studio_corrente());

-- Anche qui: nessuna scrittura per il client autenticato. L'accettazione
-- di una proposta crea l'evento e la marca "accettata" nella stessa route
-- server (chiave di servizio) esattamente come per pec_proposte — un
-- avvocato non ha bisogno di scrivere direttamente in questa tabella, solo
-- di leggerla e di premere un bottone che passa dalla route.

select
  (select count(*) from public.whatsapp_account) as account,
  (select count(*) from public.whatsapp_messaggi) as messaggi,
  (select count(*) from public.whatsapp_proposte) as proposte;

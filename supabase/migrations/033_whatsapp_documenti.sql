-- 033 — Documenti allegati ai messaggi WhatsApp
-- STATO: NON ancora applicata.
--
-- Finora un documento mandato via WhatsApp veniva scartato in silenzio
-- (il worker leggeva solo il testo). Ora si salva cifrato come gli altri
-- documenti del fascicolo — nella stessa colonna di storage, con la
-- stessa cifratura — e, se il numero risulta collegato a una sola
-- pratica non archiviata, si aggancia da solo a quella pratica; se non è
-- ancora collegato a nessun cliente, resta comunque recuperabile dal
-- messaggio stesso, non perso.

alter table public.whatsapp_messaggi
  add column if not exists documento_storage_path text,
  add column if not exists documento_nome text;

select count(*) as messaggi_con_documento
  from public.whatsapp_messaggi
 where documento_storage_path is not null;

-- 024 — PEC da leggere in evidenza, e una notifica per ogni PEC nuova
-- STATO: NON ancora applicata.

alter table public.pec_messaggi
  add column if not exists letta boolean not null default false;

-- Le PEC già in archivio si considerano lette: sono arrivate prima che
-- esistesse la distinzione, e mostrarne duecento in grassetto come "da
-- leggere" renderebbe l'evidenziazione inutile dal primo minuto.
update public.pec_messaggi set letta = true where letta = false;

/**
 * Una notifica per ogni PEC vera in arrivo.
 *
 * L'innesco sta nel database e non nel codice che scarica, perché così
 * vale per qualunque strada arrivi un messaggio: la sincronizzazione a
 * mano, quella automatica ogni tre minuti, quella notturna programmata.
 * Un innesco nell'applicazione si dimentica sempre in uno dei tre punti.
 *
 * Si notificano solo le PEC vere ricevute. Le attestazioni di accettazione
 * e consegna sono due per ogni invio: notificarle significherebbe tre
 * notifiche per ogni PEC che mandi, e una campanella che suona sempre
 * smette di voler dire qualcosa.
 */
create or replace function public.notifica_pec_nuova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direzione = 'ricevuta' and new.tipo_pec = 'posta-certificata' then
    insert into public.notifiche (studio_id, destinatario_id, tipo, testo, link, chiave_unicita)
    values (
      new.studio_id,
      -- studios.id è l'id del titolare: la notifica arriva a lui e accende
      -- il contatore della campanella.
      new.studio_id,
      'pec_ricevuta',
      'Nuova PEC da ' || coalesce(new.mittente, 'mittente sconosciuto')
        || ': ' || coalesce(new.oggetto, 'senza oggetto'),
      '/pec',
      'pec:' || new.id::text
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists pec_messaggi_notifica on public.pec_messaggi;
create trigger pec_messaggi_notifica
  after insert on public.pec_messaggi
  for each row execute function public.notifica_pec_nuova();

select count(*) filter (where letta) as lette,
       count(*) filter (where not letta) as da_leggere
  from public.pec_messaggi;

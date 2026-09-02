-- 029 — Link privato al calendario, da iscrivere in Google Calendar
-- STATO: NON ancora applicata.
--
-- Serve a dare la sincronizzazione verso il telefono SENZA passare da
-- OAuth: lo studio copia un indirizzo e lo incolla in Google Calendar
-- ("Iscriviti tramite URL"), e da lì gli impegni di Themis compaiono
-- accanto ai suoi. Niente progetto Google Cloud, niente verifica, niente
-- avviso "app non verificata", nessun tetto di utenti.
--
-- Il token È la credenziale: chi ha il link legge il calendario dello
-- studio, senza fare login. Per questo è lungo e casuale (32 byte), sta
-- in una colonna che l'interfaccia mostra solo al titolare, e si può
-- rigenerare — rigenerarlo invalida all'istante ogni iscrizione fatta
-- con il link vecchio, che è esattamente ciò che serve se è finito nelle
-- mani sbagliate.
--
-- Nasce NULL: nessuno studio ha un calendario pubblicato finché non
-- preme il pulsante. Una funzione che si attiva da sola non si sceglie.

alter table public.studio_settings
  add column if not exists calendario_ics_token text;

create unique index if not exists studio_settings_ics_token_idx
  on public.studio_settings (calendario_ics_token)
  where calendario_ics_token is not null;

select count(*) as studi_con_link_attivo
  from public.studio_settings
 where calendario_ics_token is not null;

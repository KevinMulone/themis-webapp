# Aggiornamento Themis — Studio operativo v2

## Ordine corretto

1. Aprire Supabase → SQL Editor.
2. Eseguire tutto il file `supabase/migrations/037_studio_operativo_v2.sql`.
3. Verificare che l'esecuzione termini senza errori.
4. Pubblicare il progetto su Vercel.
5. Accedere a Themis e aprire Impostazioni → Sicurezza per attivare la verifica in due passaggi.

La migrazione non cancella e non riscrive i dati esistenti. Aggiunge i registri per parti della pratica, verifiche professionali, versioni documentali, conversazioni Themis, pianificazione avanzata e calcoli salvati.

## Controllo dopo il deploy

- Creare un cliente di prova e verificare la segnalazione dei duplicati.
- Aprire una pratica e registrare un controllo conflitto d'interessi.
- Salvare un calcolo di danno o parcella nella pratica.
- Fare una domanda a Themis e ricaricare la pagina: la conversazione deve restare visibile.
- Scaricare un backup da Impostazioni → Sicurezza.
- Attivare la 2FA solo dopo avere installato un'app di autenticazione e verificato il primo codice.

## Funzioni che richiedono fornitori esterni

Firma elettronica qualificata, conservazione a norma, fatturazione elettronica e notifiche push richiedono contratti e credenziali di provider dedicati. Non sono presentate nell'app come operative finché non viene scelto e configurato il relativo fornitore.

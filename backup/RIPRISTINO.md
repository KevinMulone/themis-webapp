# Come ripristinare Themis da un backup

Servono: la **frase segreta** del backup, **Docker** acceso e un **progetto Supabase nuovo e vuoto**
(in una organizzazione dove il piano gratuito non sia bloccato). Senza la frase segreta le copie del
database non si possono aprire: tienila anche fuori dal Mac (gestore di password o foglio in cassaforte).

Nella cartella `Backup Themis` trovi:
- `database/themis-db-DATA.dump.enc` — clienti, pratiche, eventi, impostazioni (cifrato)
- `database/themis-auth-DATA.dump.enc` — gli accessi degli utenti (cifrato)
- `files/` — i documenti, già cifrati dall'app

## 1. Decifra le due copie del database
Nel Terminale, dentro la cartella `database` (sostituisci DATA con data e ora nel nome del file più recente, per esempio 2026-11-10_1301):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in themis-auth-DATA.dump.enc -out auth.dump
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in themis-db-DATA.dump.enc -out db.dump
```
Ti chiede la frase segreta. Con una frase sbagliata dice `bad decrypt`.

## 2. Carica gli accessi, poi i dati — in questo ordine
Dal pannello del progetto nuovo: **Connect → Session pooler** (host, user, password del database).

```bash
docker run --rm -i -e PGPASSWORD='LA_PASSWORD' -e PGSSLMODE=require public.ecr.aws/supabase/postgres:17.11.0.011 \
  pg_restore -h HOST -p 5432 -U USER -d postgres --no-owner --no-privileges --data-only < auth.dump
docker run --rm -i -e PGPASSWORD='LA_PASSWORD' -e PGSSLMODE=require public.ecr.aws/supabase/postgres:17.11.0.011 \
  pg_restore -h HOST -p 5432 -U USER -d postgres --no-owner --no-privileges < db.dump
```
L'ordine conta: gli accessi vanno caricati **prima** della struttura, altrimenti Supabase crea uno studio
vuoto per ogni utente che rientra. Qualche errore tipo `schema "public" already exists` è normale.

## 3. Rimetti i file dei documenti
```bash
SUPABASE_URL=https://IL-TUO-PROGETTO.supabase.co SERVICE_KEY='LA_CHIAVE_service_role' \
  python3 ripristina_file.py "…/Backup Themis/files"
```
(`ripristina_file.py` è nella cartella `backup` del codice, accanto a questo file.) Prima crea in
**Storage** il bucket `documents`, privato.

## 4. Ricollega il sito
Su Vercel cambia le variabili `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` con quelle del progetto nuovo e fai **Redeploy**.
In Supabase → Authentication → URL Configuration rimetti l'indirizzo del sito.

## Cosa NON è nel backup (conservalo a parte)
- **`DOCUMENT_ENCRYPTION_MASTER_KEY`** (nelle variabili di Vercel): senza questa chiave i documenti
  copiati in `files/` non si possono più leggere, anche se sono salvi. È la cosa più importante da non perdere.
- Le altre chiavi e variabili di Vercel (Stripe, Resend, Anthropic…).
- Le impostazioni di Authentication (URL del sito, email) e il bucket di Storage: vanno rifatti a mano.

Questa procedura è stata provata sul database di prova del Mac, non ancora su un progetto Supabase vero.

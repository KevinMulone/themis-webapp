#!/bin/bash
# Imposta il backup automatico di Themis (una volta sola). Le password restano nel Portachiavi del Mac.
cd "$(dirname "$0")" || exit 1
AQUI="$PWD"
CART="$HOME/.themis-backup"
ETICHETTA="it.studiofussone.themis-backup"
PLIST="$HOME/Library/LaunchAgents/$ETICHETTA.plist"
IMG="public.ecr.aws/supabase/postgres:17.11.0.011"
export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin:$HOME/.docker/bin"
fail() { echo; echo "ERRORE: $1"; read -r -p "Premi Invio per chiudere" _; exit 1; }

echo "=== Backup automatico di Themis ==="
echo "Ogni giorno copia il database (cifrato) e i file dei documenti nella cartella che scegli."
echo
docker info >/dev/null 2>&1 || fail "Docker non è acceso: aprilo e rilancia."

echo "1) Database. Dal pannello Supabase del progetto: pulsante Connect > 'Session pooler'."
read -r -p "   Host (es. aws-0-eu-west-1.pooler.supabase.com): " DB_HOST
read -r -p "   User (es. postgres.abcdefghijklmnop):           " DB_USER
read -r -s -p "   Password del database (non si vede): " DBPW; echo
case "$DB_USER" in postgres.*) ;; *) fail "L'User deve iniziare con 'postgres.' (è quello del Session pooler).";; esac
echo "   Verifico la connessione..."
docker run --rm -e PGPASSWORD="$DBPW" -e PGSSLMODE=require "$IMG" psql -h "$DB_HOST" -p 5432 -U "$DB_USER" -d postgres -At \
  -c "select count(*) from public.studios" >/dev/null 2>/tmp/themis_bk.err || { cat /tmp/themis_bk.err; fail "Connessione non riuscita: controlla host, user e password."; }
echo "   OK."

echo; echo "2) File dei documenti."
URL_PREDEFINITO="$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$AQUI/../.env.supabase-nuovo" 2>/dev/null | cut -d= -f2-)"
read -r -p "   Indirizzo del progetto [${URL_PREDEFINITO:-https://xxxx.supabase.co}]: " SUPABASE_URL
SUPABASE_URL="${SUPABASE_URL:-$URL_PREDEFINITO}"
echo "   Chiave segreta: Supabase > Project Settings > API Keys > 'Secret keys' > default (occhio per mostrarla, poi copia)."
echo "   Se non funziona, usa la vecchia 'service_role': pulsante 'View legacy API keys'. Sono segrete: non incollarle in chat."
read -r -s -p "   Chiave segreta (non si vede): " CHIAVE; echo
AUTH=(); case "$CHIAVE" in eyJ*) AUTH=(-H "Authorization: Bearer $CHIAVE");; esac
CODICE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SUPABASE_URL/storage/v1/object/list/documents" \
  "${AUTH[@]}" -H "apikey: $CHIAVE" -H 'Content-Type: application/json' -d '{"prefix":"","limit":1}')"
[ "$CODICE" = "200" ] || fail "Chiave o indirizzo non validi (risposta $CODICE)."
echo "   OK."

echo; echo "3) Frase segreta per cifrare la copia del database."
echo "   SCRIVILA ANCHE FUORI DAL MAC (gestore di password o foglio in cassaforte):"
echo "   se la perdi, i backup del database non si possono più aprire."
read -r -s -p "   Frase segreta (almeno 12 caratteri): " FRASE; echo
read -r -s -p "   Ripetila: " FRASE2; echo
[ "$FRASE" = "$FRASE2" ] || fail "Le due frasi non coincidono."
[ "${#FRASE}" -ge 12 ] || fail "La frase è troppo corta (almeno 12 caratteri)."

echo; echo "4) Dove salvare i backup."
DEST_PREDEFINITA="$HOME/Library/CloudStorage/Dropbox/Backup Themis"
read -r -p "   Cartella [$DEST_PREDEFINITA]: " BACKUP_DEST
BACKUP_DEST="${BACKUP_DEST:-$DEST_PREDEFINITA}"
mkdir -p "$BACKUP_DEST" || fail "Non riesco a creare $BACKUP_DEST"

mkdir -p "$CART/bin"; chmod 700 "$CART"
cat > "$CART/config.env" <<CONF
DB_HOST=$DB_HOST
DB_PORT=5432
DB_USER=$DB_USER
DB_NAME=postgres
DB_SSLMODE=require
SUPABASE_URL=$SUPABASE_URL
BACKUP_DEST="$BACKUP_DEST"
BACKUP_COPIE=30
CONF
chmod 600 "$CART/config.env"
security add-generic-password -U -a themis-backup -s themis-db-password -w "$DBPW" || fail "Portachiavi: password del database non salvata."
security add-generic-password -U -a themis-backup -s themis-service-key -w "$CHIAVE" || fail "Portachiavi: chiave non salvata."
security add-generic-password -U -a themis-backup -s themis-passphrase -w "$FRASE" || fail "Portachiavi: frase non salvata."
cp "$AQUI/backup.sh" "$AQUI/scarica_file.py" "$AQUI/RIPRISTINO.md" "$CART/bin/"
chmod +x "$CART/bin/backup.sh"

echo; echo "Primo backup (può richiedere qualche minuto)..."
bash "$CART/bin/backup.sh" || fail "Il primo backup non è riuscito: vedi il registro in ~/Library/Logs/themis-backup.log"

echo; echo "Programmo il backup ogni giorno alle 13:30 (se il Mac è spento o in sosta, parte appena si riaccende)."
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$ETICHETTA</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$CART/bin/backup.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>13</integer><key>Minute</key><integer>30</integer></dict>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$ETICHETTA" >/dev/null 2>&1
launchctl bootstrap "gui/$(id -u)" "$PLIST" || fail "Non riesco a programmare il backup."

echo
echo "Fatto. Il backup è in: $BACKUP_DEST"
echo "Registro: ~/Library/Logs/themis-backup.log"
echo "Se un backup non riesce, il Mac mostra una notifica 'Backup Themis NON riuscito'."
echo
echo "RICORDA di conservare fuori dal Mac: la frase segreta e la chiave DOCUMENT_ENCRYPTION_MASTER_KEY"
echo "(quella è nelle variabili di Vercel): senza, i documenti salvati non si leggono più."
read -r -p "Premi Invio per chiudere" _

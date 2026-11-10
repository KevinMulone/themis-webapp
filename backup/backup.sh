#!/bin/bash
# Backup di Themis: database (cifrato) + file dei documenti, nella cartella scelta (Dropbox).
# Lo lancia ogni giorno il programma "Configura backup Themis"; si può lanciare anche a mano.
# Le password stanno nel Portachiavi del Mac, mai in questo file.
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
CONF="${THEMIS_BACKUP_CONFIG:-$HOME/.themis-backup/config.env}"
LOG="$HOME/Library/Logs/themis-backup.log"
IMG="public.ecr.aws/supabase/postgres:17.11.0.011"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1
echo; echo "=== Backup Themis — $(date '+%d/%m/%Y %H:%M') ==="

fail() {
  echo "ERRORE: $1"
  osascript -e "display notification \"$1\" with title \"Backup Themis NON riuscito\"" >/dev/null 2>&1
  exit 1
}

[ -f "$CONF" ] || fail "Backup non configurato: apri 'Configura backup Themis'."
# shellcheck disable=SC1090
. "$CONF"

# Una variabile THEMIS_BACKUP_* ha la precedenza (serve per le prove); altrimenti si legge il Portachiavi.
segreto() {
  local var="THEMIS_BACKUP_$1"
  if [ -n "${!var:-}" ]; then printf %s "${!var}"; else security find-generic-password -a themis-backup -s "themis-$2" -w 2>/dev/null; fi
}
DBPW="$(segreto DB_PASSWORD db-password)"
CHIAVE="$(segreto SERVICE_KEY service-key)"
FRASE="$(segreto PASSPHRASE passphrase)"
[ -n "$DBPW" ] && [ -n "$CHIAVE" ] && [ -n "$FRASE" ] || fail "Password non trovate nel Portachiavi: rilancia 'Configura backup Themis'."

export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin:$HOME/.docker/bin"
if ! docker info >/dev/null 2>&1; then
  echo "Docker spento: lo accendo..."
  open -a Docker
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 3; done
  docker info >/dev/null 2>&1 || fail "Docker non si accende."
fi

DEST="${BACKUP_DEST:?}"
mkdir -p "$DEST/database" "$DEST/files" || fail "Non riesco a scrivere in $DEST"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
DATA="$(date +%Y-%m-%d_%H%M)"

dump() {
  docker run --rm -e PGPASSWORD="$DBPW" -e PGSSLMODE="${DB_SSLMODE:-require}" "$IMG" \
    pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "${DB_NAME:-postgres}" "$@"
}
verifica() {  # un dump che pg_restore non sa leggere non vale nulla
  docker run --rm -i "$IMG" pg_restore -l < "$1" >/dev/null 2>&1
}
cifra() {
  FRASE="$FRASE" openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:FRASE -in "$1" -out "$2"
}

echo "1/3 Database (dati dello studio)..."
dump -Fc --no-owner --no-privileges -n public > "$TMP/db.dump" 2>"$TMP/db.err" \
  || { cat "$TMP/db.err"; fail "Copia del database non riuscita (controlla host, user e password)."; }
verifica "$TMP/db.dump" || fail "La copia del database è illeggibile: non la salvo."
echo "2/3 Accessi degli utenti..."
dump -Fc --no-owner --no-privileges --data-only -t auth.users -t auth.identities > "$TMP/auth.dump" 2>"$TMP/auth.err" \
  || { cat "$TMP/auth.err"; fail "Copia degli accessi non riuscita."; }
verifica "$TMP/auth.dump" || fail "La copia degli accessi è illeggibile: non la salvo."

cifra "$TMP/db.dump" "$DEST/database/themis-db-$DATA.dump.enc" || fail "Cifratura non riuscita."
cifra "$TMP/auth.dump" "$DEST/database/themis-auth-$DATA.dump.enc" || fail "Cifratura non riuscita."
echo "   database: $(du -h "$DEST/database/themis-db-$DATA.dump.enc" | cut -f1) · accessi: $(du -h "$DEST/database/themis-auth-$DATA.dump.enc" | cut -f1)"

echo "3/3 File dei documenti..."
SUPABASE_URL="$SUPABASE_URL" SERVICE_KEY="$CHIAVE" python3 "$AQUI/scarica_file.py" "$DEST/files" \
  || fail "Alcuni file dei documenti non sono stati copiati: vedi $LOG"

# Si tengono le ultime N copie del database; i file dei documenti non si cancellano mai.
for prefisso in themis-db themis-auth; do
  ls -1t "$DEST/database/$prefisso"-*.enc 2>/dev/null | tail -n +$(( ${BACKUP_COPIE:-30} + 1 )) | while IFS= read -r vecchio; do rm -f "$vecchio"; done
done
[ -f "$AQUI/RIPRISTINO.md" ] && cp "$AQUI/RIPRISTINO.md" "$DEST/RIPRISTINO.md"
date '+%d/%m/%Y %H:%M' > "$DEST/ultimo-backup.txt"
echo "Fatto: $DEST"

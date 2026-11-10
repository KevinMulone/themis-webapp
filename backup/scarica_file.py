#!/usr/bin/env python3
"""Copia in locale i file dei documenti di Themis (bucket "documents" di Supabase Storage).

Uso:  SUPABASE_URL=... SERVICE_KEY=... python3 scarica_file.py CARTELLA_DESTINAZIONE

- Scarica solo i file nuovi o cambiati (un elenco .manifest.json ricorda cosa c'è già).
- Non cancella mai nulla dalla destinazione: se un file sparisce da Supabase, la copia resta.
- I file sono già cifrati dall'app (AES-256-GCM): si copiano così come sono, senza toccarli.
  Per leggerli servono la chiave DOCUMENT_ENCRYPTION_MASTER_KEY e, quindi, di conservarla a parte.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BUCKET = "documents"
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
CHIAVE = os.environ.get("SERVICE_KEY", "")
if not URL or not CHIAVE or len(sys.argv) != 2:
    sys.exit("Uso: SUPABASE_URL=... SERVICE_KEY=... python3 scarica_file.py CARTELLA")
DEST = sys.argv[1]
# Le chiavi nuove (sb_secret_...) vanno solo nell'intestazione apikey; la vecchia service_role (un JWT, inizia con eyJ)
# va anche come Bearer.
INTESTAZIONI = {"apikey": CHIAVE}
if CHIAVE.startswith("eyJ"):
    INTESTAZIONI["Authorization"] = "Bearer " + CHIAVE


def chiama(percorso, corpo=None, tentativi=3):
    dati = json.dumps(corpo).encode() if corpo is not None else None
    for n in range(tentativi):
        richiesta = urllib.request.Request(
            URL + percorso, data=dati, method="POST" if corpo is not None else "GET",
            headers={**INTESTAZIONI, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(richiesta, timeout=60) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError) as e:
            if n == tentativi - 1:
                raise
            time.sleep(2 * (n + 1))


def elenco(prefisso=""):
    """Tutti i file sotto un prefisso, cartelle comprese."""
    trovati, offset = [], 0
    while True:
        pagina = json.loads(chiama(f"/storage/v1/object/list/{BUCKET}", {
            "prefix": prefisso, "limit": 100, "offset": offset,
            "sortBy": {"column": "name", "order": "asc"}}))
        for voce in pagina:
            nome = f"{prefisso}{voce['name']}"
            if voce.get("id") is None:      # una cartella
                trovati += elenco(nome + "/")
            else:
                meta = voce.get("metadata") or {}
                trovati.append((nome, meta.get("size"), voce.get("updated_at")))
        if len(pagina) < 100:
            return trovati
        offset += 100


os.makedirs(DEST, exist_ok=True)
percorso_manifest = os.path.join(DEST, ".manifest.json")
try:
    with open(percorso_manifest, encoding="utf-8") as f:
        manifest = json.load(f)
except (OSError, ValueError):
    manifest = {}

file_remoti = elenco()
nuovi = errori = 0
for nome, dimensione, aggiornato in file_remoti:
    firma = [dimensione, aggiornato]
    locale = os.path.join(DEST, *nome.split("/"))
    if manifest.get(nome) == firma and os.path.exists(locale):
        continue
    try:
        contenuto = chiama(f"/storage/v1/object/{BUCKET}/{urllib.parse.quote(nome, safe='/')}")
        os.makedirs(os.path.dirname(locale), exist_ok=True)
        with open(locale + ".part", "wb") as f:
            f.write(contenuto)
        os.replace(locale + ".part", locale)
        manifest[nome] = firma
        nuovi += 1
    except Exception as e:  # un file che non si scarica non deve fermare gli altri
        errori += 1
        print(f"ERRORE su {nome}: {e}", file=sys.stderr)

with open(percorso_manifest + ".tmp", "w", encoding="utf-8") as f:
    json.dump(manifest, f)
os.replace(percorso_manifest + ".tmp", percorso_manifest)
print(f"File su Supabase: {len(file_remoti)} · nuovi o aggiornati: {nuovi} · errori: {errori}")
sys.exit(1 if errori else 0)

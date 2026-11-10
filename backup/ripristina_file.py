#!/usr/bin/env python3
"""Rimette in Supabase Storage i file dei documenti salvati dal backup.

Uso:  SUPABASE_URL=... SERVICE_KEY=... python3 ripristina_file.py "…/Backup Themis/files"

Carica ogni file nel bucket "documents" con lo stesso percorso che aveva; se esiste già lo
sostituisce. I file sono ancora cifrati: Themis li legge con la sua chiave
(DOCUMENT_ENCRYPTION_MASTER_KEY), che deve essere la stessa di prima.
"""
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BUCKET = "documents"
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
CHIAVE = os.environ.get("SERVICE_KEY", "")
if not URL or not CHIAVE or len(sys.argv) != 2:
    sys.exit('Uso: SUPABASE_URL=... SERVICE_KEY=... python3 ripristina_file.py "CARTELLA/files"')
BASE = sys.argv[1]
caricati = errori = 0
for radice, _, nomi in os.walk(BASE):
    for nome in nomi:
        if nome == ".manifest.json" or nome.endswith((".part", ".tmp")):
            continue
        locale = os.path.join(radice, nome)
        percorso = os.path.relpath(locale, BASE).replace(os.sep, "/")
        with open(locale, "rb") as f:
            corpo = f.read()
        richiesta = urllib.request.Request(
            f"{URL}/storage/v1/object/{BUCKET}/{urllib.parse.quote(percorso, safe='/')}", data=corpo, method="POST",
            headers={"Authorization": "Bearer " + CHIAVE, "apikey": CHIAVE,
                     "Content-Type": "application/octet-stream", "x-upsert": "true"})
        try:
            urllib.request.urlopen(richiesta, timeout=120).read()
            caricati += 1
        except (urllib.error.URLError, TimeoutError) as e:
            errori += 1
            print(f"ERRORE su {percorso}: {e}", file=sys.stderr)
print(f"File ripristinati: {caricati} · errori: {errori}")
sys.exit(1 if errori else 0)

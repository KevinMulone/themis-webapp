# Migrazioni del database

Le migrazioni qui dentro vengono **applicate a mano** nell'SQL Editor di
Supabase: non c'è la CLI di Supabase collegata a questo progetto, e non c'è
nessuno strumento che le esegua automaticamente al deploy.

Vanno committate lo stesso, e questo è il punto: fino ad oggi lo schema del
database (tabelle, policy di sicurezza, funzioni, trigger) viveva **solo**
sul progetto Supabase remoto, invisibile da qui. Chiunque leggesse il
codice non poteva sapere quali regole di sicurezza proteggessero davvero i
dati, né ricostruire il database da zero. Da qui in avanti ogni modifica
allo schema si scrive prima in un file numerato in questa cartella, e poi
si esegue.

## Convenzione

- Un file per modifica, numerato progressivamente: `NNN_descrizione.sql`.
- In testa a ogni file: cosa fa, perché, e **se è già stata applicata**.
- Mai modificare un file già applicato: se serve un correttivo, se ne
  scrive uno nuovo.
- Le migrazioni `001`-`004` sono state ricostruite a posteriori (agosto
  2026) da quanto effettivamente eseguito durante lo sviluppo: sono già
  applicate in produzione, non vanno rieseguite.

## Stato

| File | Applicata |
|---|---|
| `001_stripe.sql` | ✅ sì |
| `002_finestra_rimborso.sql` | ✅ sì |
| `003_tempo_utilizzo.sql` | ✅ sì |
| `004_document_requests.sql` | ✅ sì |
| `005_studio_membri.sql` | ❌ **no** — richiede prima la diagnostica (vedi il file) |

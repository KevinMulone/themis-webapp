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
| `005_studio_membri.sql` | ❌ **no** |
| `006_policy_collaboratori.sql` | ❌ **no** — subito dopo la 005 |

## Esito della diagnostica (31.08.2026)

Eseguita `000_diagnostica_sola_lettura.sql`. Tre risultati che condizionano
tutto il progetto collaboratori:

1. **Tutte le policy esistenti sono PERMISSIVE**, nessuna RESTRICTIVE →
   le nuove policy si possono aggiungere accanto a quelle attuali senza
   toccarle, perché le permissive si sommano in OR.
2. **`relforcerowsecurity` è `false` su tutte e 22 le tabelle** → la
   funzione `studio_corrente()`, che è `SECURITY DEFINER` e legge
   `studio_membri`, non entra in ricorsione con la policy di quella stessa
   tabella.
3. **Due trigger su `auth.users`**: `on_auth_user_created` →
   `handle_new_studio()` e `on_portal_client_created` →
   `handle_new_portal_client()`. Confermato quindi che a ogni nuovo utente
   Auth corrisponde automaticamente una riga `studios`: è il motivo per cui
   `studio_corrente()` risolve l'appartenenza **prima** della proprietà, e
   per cui la creazione di un collaboratore dovrà ripulire la riga orfana.

Nota emersa di sfuggita: esiste già una funzione
`send_appointment_reminders()`, quindi un'infrastruttura di promemoria è
presente (probabilmente pianificata con pg_cron). Utile a sapersi quando si
vorranno notificare gli incarichi via email invece che col solo contatore
in-app.

# Themis

Gestionale per studi legali italiani: fascicoli, PEC, WhatsApp, calendario,
assistente IA sul fascicolo, generazione atti, deposito telematico e
calcoli forensi — in una sola applicazione.

Prodotto in esercizio, non un esercizio di stile: nasce dallo Studio Legale
Fussone (San Cataldo, CL) e viene usato tutti i giorni su pratiche vere.

- **Produzione:** https://themis-webapp-6ccd.vercel.app
- **Repository:** https://github.com/KevinMulone/themis-webapp
- **Codice:** ~24.000 righe TypeScript/TSX (181 file) + ~2.500 righe SQL

---

## Indice

1. [Architettura](#1-architettura)
2. [Servizi di terze parti](#2-servizi-di-terze-parti)
3. [Variabili d'ambiente](#3-variabili-dambiente)
4. [Funzionalità](#4-funzionalità)
5. [Ruoli e permessi](#5-ruoli-e-permessi)
6. [Modello dati](#6-modello-dati)
7. [Sicurezza](#7-sicurezza)
8. [L'assistente IA](#8-lassistente-ia)
9. [Calcoli forensi e fonti normative](#9-calcoli-forensi-e-fonti-normative)
10. [Sviluppo locale](#10-sviluppo-locale)
11. [Deploy e operatività](#11-deploy-e-operatività)
12. [Problemi noti e debito tecnico](#12-problemi-noti-e-debito-tecnico)

---

## 1. Architettura

### Stack

| Livello | Tecnologia |
|---|---|
| Framework | Next.js **16.3.3** (App Router, React 19.2.8) |
| Linguaggio | TypeScript 5 |
| Stile | Tailwind CSS v4 (`@theme inline`, token bordeaux/oro in `globals.css`) |
| Animazioni | `motion` ^13.2.0 + keyframe CSS proprietarie |
| Database / Auth / Storage / Realtime | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Runtime aggiuntivi | Funzione serverless **Python** (generazione .docx) + servizio **Node persistente** (WhatsApp) |

### I tre processi

Themis non è un solo deployable. Sono tre pezzi con cicli di vita diversi,
e la separazione è deliberata:

```
┌────────────────────────────────────────────────────────────┐
│  VERCEL                                                     │
│                                                             │
│  ┌───────────────────────┐   ┌──────────────────────────┐  │
│  │ Next.js (App Router)  │   │ api/generate.py          │  │
│  │ UI + ~66 route API    │   │ Python Runtime           │  │
│  │ Node.js              │   │ python-docx + cryptography│  │
│  └───────────┬───────────┘   └────────────┬─────────────┘  │
│              │      cron: /api/pec/sync   │                │
└──────────────┼────────────────────────────┼────────────────┘
               │                            │
               ▼                            ▼
        ┌──────────────────────────────────────────┐
        │  SUPABASE                                 │
        │  PostgreSQL + RLS · Auth · Storage        │
        │  Realtime (7 tabelle)                     │
        └──────────────────────────────────────────┘
               ▲
               │  webhook HTTP autenticati (Bearer)
               │
┌──────────────┴─────────────────────────────────────────────┐
│  RAILWAY / FLY.IO  —  whatsapp-worker/                      │
│  Processo sempre acceso + volume persistente                │
│  @whiskeysockets/baileys (WhatsApp Web multi-device)        │
└─────────────────────────────────────────────────────────────┘
```

**Perché il worker WhatsApp è separato:** la connessione con WhatsApp deve
restare aperta di continuo. Una funzione serverless vive quanto una
richiesta, quindi non può reggerla. Serve un host con processo persistente
*e* disco persistente (le credenziali Signal di ogni studio stanno su disco:
senza volume, ogni riavvio costringe tutti a riscansionare il QR).

**Perché la generazione .docx è in Python:** `python-docx` sostituisce i
segnaposto dentro i `run` di Word — inclusi quelli spezzati su più run,
tabelle, intestazioni e piè di pagina — che in JavaScript avrebbe richiesto
di riscrivere la stessa logica. Tutto in **un solo file**: Vercel non
impacchetta gli altri `.py` della stessa cartella, quindi qualunque
`from _modulo import x` fallisce a runtime.

### Multi-tenancy: "un utente = uno studio"

Il perno è la funzione Postgres `studio_corrente()`, che risponde a
"a quale studio appartengo". La stessa identica logica vale per le regole di
sicurezza del database, per l'app e per la generazione atti in Python — non
esistono tre risposte diverse alla stessa domanda.

Risolve **prima l'appartenenza** (`studio_membri` con `stato = 'attivo'`) e
**poi la proprietà** (`studios.id = auth.uid() AND plan IS NOT NULL`). L'ordine
non è casuale: un trigger su `auth.users` crea una riga `studios` per *ogni*
nuovo utente, quindi anche un collaboratore ne ha una, orfana; il
`plan IS NOT NULL` è la seconda rete.

`contesto_studio()` restituisce in una sola chiamata studio, ruolo, piano e
stato dell'abbonamento — perché il layout ne faceva già una sola.

---

## 2. Servizi di terze parti

| Servizio | Uso | Stato | Configurato via |
|---|---|---|---|
| **Supabase** | Database, Auth, Storage, Realtime | ✅ attivo | `NEXT_PUBLIC_SUPABASE_URL`, `..._ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Vercel** | Hosting Next.js + funzione Python + cron | ✅ attivo | deploy su `git push` |
| **Anthropic (Claude)** | Assistente IA — modello `claude-opus-5` | ✅ attivo | `ANTHROPIC_API_KEY` |
| **Stripe** | Abbonamenti, checkout, portale cliente | ✅ attivo | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` |
| **Resend** | Email transazionali (chiave licenza, richieste rimborso) | ✅ attivo | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Gestori PEC** (IMAP/SMTP diretto) | Posta certificata | ✅ attivo | credenziali per casella, nel database (cifrate) |
| **WhatsApp via Baileys** | Chat dello studio | ⚙️ opzionale | `WHATSAPP_WORKER_URL`, `WHATSAPP_WORKER_SECRET` |
| **Google Calendar API v3** | Sincronizzazione calendario (OAuth) | ⚙️ opzionale | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Portale Giustizia Civile** | Deep link ai registri di cancelleria | ✅ attivo | nessuna credenziale (link pubblico) |

Le due voci "opzionali" degradano con grazia: senza le variabili d'ambiente,
l'interfaccia lo dichiara e nasconde i pulsanti, senza rompersi.

### PEC — IMAP/SMTP diretto, nessun intermediario

Niente SaaS in mezzo: connessione diretta ai server dei gestori italiani con
`imapflow` (lettura), `nodemailer` (invio), `mailparser` + `fast-xml-parser`
(interpretazione della busta).

Il riconoscimento del tipo di messaggio **non è euristico**: segue il DM 2
novembre 2005, leggendo `daticert.xml` (radice `<postacert tipo="...">`). I 9
tipi previsti — `posta-certificata`, `accettazione`, `non-accettazione`,
`presa-in-carico`, `avvenuta-consegna`, `errore-consegna`,
`preavviso-errore-consegna`, `rilevazione-virus`, `sconosciuto`. Solo per
`posta-certificata` il contenuto vero si legge da `postacert.eml`: nella busta
il mittente è il gestore, non chi ha scritto.

Gestori preconfigurati (l'host resta comunque un campo libero):

| Gestore | IMAP | Porta |
|---|---|---|
| Aruba | `imaps.pec.aruba.it` | 993 |
| Namirial / Sicurezza Postale | `imaps.sicurezzapostale.it` | 993 |

L'host SMTP è derivato per convenzione (`imaps.` → `smtps.`, porta 465), non
configurabile dall'interfaccia.

**Sincronizzazione a due segnalibri:** `last_seen_uid` sale verso i messaggi
nuovi, `arretrato_fino_a` scende verso lo storico. Massimo 25 messaggi per
giro. Il browser fa un giro ogni 3 minuti quando la scheda è visibile (con
turno condiviso via `localStorage`, perché i gestori PEC rifiutano connessioni
IMAP simultanee); se non c'è nulla di nuovo parte automaticamente un passo di
arretrato, così l'archivio si completa da solo. Il cron di Vercel fa un giro
al giorno alle 05:00 UTC anche a Themis chiuso.

Se `UIDVALIDITY` cambia, i segnalibri si azzerano: altrimenti si salterebbero
messaggi in silenzio.

**Invio:** il byte grezzo viene composto **una volta sola** e lo stesso identico
byte viene poi depositato nella cartella "inviata" via IMAP APPEND —
ricomporlo darebbe due `Message-ID` diversi. Se il deposito fallisce non è un
errore: la PEC è già partita, è un fatto giuridico compiuto.

### WhatsApp — Baileys, **non** l'API ufficiale Meta

`@whiskeysockets/baileys` **6.7.24**, versione pinnata esatta. Imita il
protocollo WhatsApp Web multi-dispositivo, che WhatsApp non pubblica e può
cambiare senza preavviso.

I rischi sono reali e vanno detti: numero non ufficiale, possibilità di blocco
del numero, libreria che insegue un protocollo altrui. Per questo il worker
chiede **un numero dedicato allo studio**, mai il cellulare personale di un
avvocato.

Il worker riceve in push da WhatsApp e chiama tre webhook distinti su Themis
(`/webhook` testo, `/webhook-documento` media, `/webhook-stato` spunte di
consegna). Import iniziale della cronologia: ultimi 30 giorni, massimo 300
messaggi, 150 ms di pausa tra l'uno e l'altro.

**Abbinamento numero → cliente:** `clients.telefono` è un campo libero, WhatsApp
manda un JID pulito. Si normalizza (via il non-numerico e il prefisso `39`) e si
confrontano le **ultime 9 cifre**. La pratica si aggancia **solo se ce n'è
esattamente una** non archiviata: indovinare fra due sarebbe sbagliare tanto
quanto non collegare nulla.

### Google Calendar — REST diretto, nessun SDK

Tre endpoint in tutto, chiamati con `fetch`: importare il pacchetto
`googleapis` porterebbe dentro i client di decine di API per niente.

Scope minimi: `calendar.events` + `userinfo.email` — lo scope pieno `calendar`
permetterebbe di cancellare interi calendari e cambiarne le condivisioni.

L'`access_token` **non viene mai salvato**: si riottiene da capo a ogni chiamata
decifrando il refresh token. Solo il refresh token persiste, cifrato, in una
tabella senza alcuna policy RLS (deny-all: solo service role).

Sincronizzazione **in una sola direzione** (Themis → Google) e fire-and-forget:
un fallimento non blocca il salvataggio dell'evento. L'import Google → Themis
è manuale, su richiesta, e tutto entra come tipo "altro" perché Google non sa
distinguere un'udienza da un appuntamento.

**Alternativa senza OAuth:** un feed **ICS** (RFC 5545) scritto a mano, da
incollare in Google/Apple/Outlook come "Iscriviti tramite URL". Niente progetto
Google Cloud, niente verifica, nessun tetto di utenti. Include il `VTIMEZONE`
Europe/Rome per esteso invece di convertire in UTC: un'udienza spostata a
cavallo del cambio dell'ora finirebbe nell'ora sbagliata.

---

## 3. Variabili d'ambiente

### Webapp (Vercel)

| Variabile | Obbligatoria | Serve a |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Client Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Client Supabase (pubblica per costruzione) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Operazioni server che devono scavalcare la RLS |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Redirect OAuth, link nelle email |
| `DOCUMENT_ENCRYPTION_MASTER_KEY` | ✅ | Cifratura di **tutti** i documenti (base64) |
| `ANTHROPIC_API_KEY` | ✅ | Assistente IA (senza: 503 leggibile) |
| `STRIPE_SECRET_KEY` | ✅ | Checkout e portale abbonamenti |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Verifica firma webhook Stripe |
| `STRIPE_PRICE_MONTHLY` / `_SEMESTRALE` / `_ANNUALE` | ✅ | Prezzi dei tre piani |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | ✅ | Email transazionali |
| `ADMIN_EMAIL` | ✅ | Unico accesso a `/admin` e destinatario richieste rimborso |
| `LICENSE_ED25519_PRIVATE_KEY_PEM` | ✅ | Firma delle chiavi di licenza `THM-…` |
| `CRON_SECRET` | ✅ | Autorizza il cron PEC (senza, la porta resta chiusa) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ⚙️ | Google Calendar via OAuth |
| `WHATSAPP_WORKER_URL`, `WHATSAPP_WORKER_SECRET` | ⚙️ | Servizio WhatsApp |

### Worker WhatsApp (Railway / Fly.io)

| Variabile | Serve a |
|---|---|
| `PORT` | Porta di ascolto (di solito la impone l'host) |
| `WHATSAPP_WORKER_SECRET` | **Identico** a quello su Vercel: autenticazione reciproca |
| `VERCEL_WEBHOOK_URL` | Es. `https://…/api/whatsapp/webhook` |
| `DATA_DIR` | Sessioni WhatsApp — **deve** essere un volume persistente |
| `LOG_LEVEL` | `silent` in produzione (`debug` logga anche il testo dei messaggi) |

> `.env*` è in `.gitignore`. Nessun segreto è mai stato committato.

---

## 4. Funzionalità

### Area studio (`/dashboard` e seguenti)

**Dashboard** — sei tessere cliccabili (clienti, pratiche attive,
udienze/termini a 7 giorni, prenotazioni da confermare, PEC non lette,
incarichi assegnati a me), prossime scadenze, pratiche recenti, azioni rapide.

**Clienti** — anagrafica persone fisiche e giuridiche, ricerca su
nome/CF/P.IVA/email/telefono, filtri, ordinamento, paginazione, export CSV
(con BOM UTF-8 per Excel), archiviazione morbida ed eliminazione definitiva,
documenti generati per cliente, **invito al portale clienti**.

**Pratiche** — elenco con ricerca multi-termine, filtri per stato e materia
(11 tipi: ATP invalidità, sinistro, ricorso INPS, causa civile, successione,
lavoro, penale, immigrazione, sovraindebitamento, mediazione condominiale,
altro), export CSV. Creando una pratica di tipo *sinistro* nasce anche la
riga dei dati sinistro.

**Fascicolo** (`/pratiche/[id]`) — la pagina più densa:
- dati pratica (stato, responsabile, controparte, compagnia, tribunale,
  sezione, R.G., giudice, date, metodo pagamento)
- verifica sul **portale Giustizia Civile** con link precompilato
- documenti (caricamento e download, sempre cifrati)
- **Chiedi a Themis** — domande sul fascicolo con citazione di documento e pagina
- **Fai preparare un atto a Themis** — bozza con `.docx` scaricabile
- incarichi con storico
- documenti richiesti al cliente (visibili nel portale)
- patrocinio a spese dello Stato (istanza → decreto → fattura → incasso)
- **scadenze legali suggerite** con sospensione feriale e riferimento normativo
- dati sinistro e testimoni (solo per le pratiche di tipo sinistro)

**Calendario** — viste giorno/settimana/mese, legenda cliccabile per famiglie
di eventi, griglia costruita sulle fasce di apertura dello studio,
prenotazioni dal portale clienti da accettare o rifiutare, mini-calendario e
prossimi eventi, scadenze imminenti. Ogni evento creato viene copiato su
Google in background, se collegato.

**PEC** — schede Ricevute / Inviate / Attestazioni con contatori, selettore
del periodo mese per mese, ricerca, filtro "solo non lette", ordinamento,
paginazione. Per ogni messaggio: apertura (solo testo semplice, l'HTML non
viene renderizzato), allegati, download del `.eml` — l'unico documento con
valore probatorio. **Nuova PEC** in due fasi con schermata di conferma, con
possibilità di far scrivere la bozza a Themis. **Scadenze trovate nelle PEC**:
l'IA propone, l'avvocato accetta o scarta — niente entra in calendario da solo.

**WhatsApp** — messaggi con documento da collegare a un cliente (con proposta
di abbinamento dell'IA e motivazione), casella chat con spunte di consegna,
composizione con bozza IA, scadenze estratte dai messaggi. **Reparto
fascicoli**: tutti gli allegati ricevuti, raggruppati per assistito.

**Genera Atto** — modello `.docx` + pratica → documento compilato. I segnaposto
automatici si riempiono dai dati (cliente, pratica, sinistro), quelli manuali
si chiedono, con proposte dai valori già usati.

**Deposito** — non costruisce la busta PCT e non firma nulla. Produce due cose:
una **lista di controllo pre-deposito** (ufficio, controparte, documenti, dati
difensore, PEC) e un **prontuario ricalcato sulle schermate di SLpct**
(5.1 dati generali, 5.2 contributo unificato, 5.3 partecipanti, 5.4 avvocato,
5.6 allegati, 5.7 attestazione di conformità), con copia riga per riga. Più un
**pacchetto .zip** con atto principale e allegati rinominati in ordine. I file
firmati fuori (Dike, ArubaSign, SLpct) si ricaricano **accanto** agli originali.

**Calcolo Danno** — tre calcolatori: Tabelle di Milano 2024, art. 139 Cod. Ass.
(micropermanenti 1-9%), TUN art. 138 (macropermanenti 10-100%).

**Parcelle** — parametri forensi su 7 tipi di procedimento, fase per fase, con
spese forfettarie, Cassa Forense e IVA.

**Patrocinio Stato** — tutte le pratiche a spese dello Stato con lo stato di
avanzamento calcolato ("in attesa del decreto", "decreto arrivato: emettere
fattura", …).

**Giustizia Civile** — elenco delle pratiche con R.G. e link precompilato al
portale del Ministero.

**Incarichi** — assegnazione fra membri, priorità, scadenze, presa in carico,
passaggio, riapertura. Storico scritto dai trigger del database.

**Impostazioni** — password, abbonamento e rimborso, scheda per l'elenco
pubblico studi, carta intestata, tipografia dei documenti, dati del difensore,
orari per il portale, Google Calendar (OAuth + ICS + import), WhatsApp,
caselle PEC, modelli.

**Collaboratori** e **Registro attività** — solo titolare.

### Portale clienti (`/portale`)

Il cliente non entra mai nell'area studio. Vede soltanto i propri
appuntamenti, la prenotazione di nuovi slot (con promemoria email a scelta) e
i documenti che lo studio gli ha chiesto, con il caricamento.

### Pannello amministratore (`/admin`)

Riservato all'unico utente la cui email coincide con `ADMIN_EMAIL`. KPI,
richieste di rimborso, tetti di spesa IA per piano, consumo per abbonato,
generazione chiavi di licenza, creazione studi, gestione scadenze e stati.

### Sito pubblico

`/` (landing con carosello sponsor), `/studi` (elenco pubblico degli studi
con piano annuale che hanno scelto di farsi trovare), `/sponsor`, `/privacy`,
`/politica-rimborsi`, `/accedi`, `/registrati`, `/attiva`, `/unisciti`,
`/reimposta-password`, `/account-sospeso`.

---

## 5. Ruoli e permessi

Tre ruoli applicativi più l'amministratore (identificato dall'email, non dal ruolo).

### Solo il titolare

| Ambito | Cosa |
|---|---|
| Pagine (gate server-side) | `/collaboratori`, `/attivita` |
| PEC | inviare una PEC ("è un atto giuridico"), aggiungere/rimuovere caselle |
| Collaboratori | invitare, disattivare, rimuovere |
| Google Calendar | collegare, scollegare, mettere in pausa, importare |
| WhatsApp | collegare e scollegare il numero |
| Calendario | creare/rigenerare/spegnere il link ICS pubblico |
| Licenze | attivare o riscattare una chiave |
| Interfaccia | blocco Abbonamento e Elenco studi, scheda "Studio" delle notifiche, toggle "vedi tutto lo studio" negli incarichi, eliminazione di un incarico |

### Titolare e collaboratore insieme

Clienti, pratiche, fascicoli, calendario, lettura PEC, chat WhatsApp e invio
messaggi, tutto l'assistente IA, Genera Atto, Deposito, Calcolo Danno,
Parcelle, Patrocinio, Giustizia Civile, e la parte non riservata delle
impostazioni.

Le voci di menu nascoste sono una cortesia: **il controllo vero è sempre lato
server**, nelle route API e nelle policy del database.

### Posti collaboratore per piano

| Piano | Prezzo | Collaboratori (oltre al titolare) | Assistente IA |
|---|---|---|---|
| Mensile | 100 €/mese | 1 | ❌ non incluso |
| Semestrale | 500 €/6 mesi | 3 | ✅ con limite mensile |
| Annuale | 1.100 €/anno | 5 | ✅ margine più ampio + spazio sponsor gratuito |

---

## 6. Modello dati

Le migrazioni **non contengono lo schema completo**: lo schema di base è stato
creato a mano su Supabase prima che esistesse la cartella `supabase/migrations/`
e non è mai stato versionato. Da agosto 2026 ogni modifica si scrive prima in
un file numerato e poi si esegue.

### Tabelle principali per area

| Area | Tabelle |
|---|---|
| Studio e accessi | `studios`, `studio_membri`, `studio_settings`, `issued_licenses` |
| Anagrafiche e pratiche | `clients`, `matters`, `sinistri`, `testimoni`, `patrocini_spese_stato` |
| Documenti | `documenti`, `templates`, `template_placeholders`, `document_requests` |
| Calendario | `eventi`, `appointments`, `availability_rules`, `google_calendar_account`, `google_calendar_credenziali` |
| PEC | `pec_account`, `pec_credenziali`, `pec_cartelle`, `pec_messaggi`, `pec_proposte` |
| WhatsApp | `whatsapp_account`, `whatsapp_messaggi`, `whatsapp_proposte`, `whatsapp_bozza_feedback` |
| IA | `ai_utilizzo`, `limiti_assistente`, `stili_atto`, `atto_feedback` |
| Lavoro e tracciabilità | `incarichi`, `incarichi_storico`, `notifiche` |
| Portale clienti | `portal_clients`, `portal_invites` |
| Fatturazione | `stripe_webhook_events` |
| Sito pubblico | `sponsors`, `sponsor_richieste` |

### Funzioni Postgres notevoli

| Funzione | Scopo |
|---|---|
| `studio_corrente()` | Il perno del multi-tenant: a quale studio appartengo |
| `ruolo_corrente()`, `e_titolare()` | Ruolo dell'utente corrente |
| `contesto_studio()` | Studio + ruolo + piano + abbonamento, in una sola chiamata |
| `invito_portale(p_code)` | Legge **una sola riga** di `portal_invites` dato il codice |
| `cliente_portale_corrente()` | Il `client_id` del cliente loggato nel portale |
| `redeem_license(p_license_id)` | Riscatto di una chiave `THM-…` |
| `get_taken_slots(...)` | Slot già occupati, per il portale |
| `genera_notifiche_scadenze()` | Notifiche di scadenza (chiamata all'apertura della campanella: non c'è pg_cron) |

### Storage

Bucket unico **`documents`**, con prefissi per tipo: `documenti/`, `templates/`,
`letterheads/`, `pec/`. Ogni file è **cifrato prima dell'upload** (estensione
`.enc`) e ogni accesso passa dal service role — mai direttamente dal browser.

### Realtime

Sette tabelle pubblicate: `notifiche`, `incarichi`, `incarichi_storico`,
`document_requests`, `appointments`, `pec_messaggi`, `pec_account`.

Sulle prime cinque è impostato `replica identity full`: senza, su UPDATE e
DELETE PostgreSQL trasmette la sola chiave primaria, Realtime non può
verificare le policy RLS sulla riga vecchia e **non consegna l'evento a
nessuno**.

---

## 7. Sicurezza

### Row Level Security — un solo pattern, ripetuto

```sql
create policy <nome> on public.<tabella>
  for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (studio_id = public.studio_corrente());
```

L'isolamento fra studi passa interamente dalla funzione `studio_corrente()`.

**Le regole restrittive stanno nei trigger, non nelle policy.** Le policy
permissive si sommano in OR: una policy più stretta non può togliere ciò che
una più larga già concede. Perciò "solo il titolare elimina" e "si assegna solo
a un membro attivo dello stesso studio" sono trigger `BEFORE` che sollevano
eccezione.

**Tabelle deny-all** (RLS attiva, zero policy — leggibili solo con service
role): `pec_credenziali`, `google_calendar_credenziali`,
`stripe_webhook_events`. Ogni integrazione con credenziali usa due tabelle:
una leggibile per l'interfaccia, una segreta.

**Notifiche e storico non sono falsificabili dal browser:** sulle rispettive
tabelle non esiste permesso di INSERT, li scrivono solo i trigger.

### La falla di `portal_invites` (chiusa il 31.08.2026)

Vale la pena raccontarla, perché è un tranello classico della RLS.

La policy si chiamava *"Chiunque legge un invito dato il codice"* ed era
scritta `for select to public using (true)`. Il nome esprimeva l'intenzione
giusta, ma **una policy non può filtrare in base a ciò che c'era nella query**:
il database non sa che il codice era nel `WHERE`. `USING (true)` significa
"tutte le righe, sempre", e `to public` comprende `anon`.

Siccome la chiave anonima di Supabase è pubblica per costruzione — sta nel
JavaScript che ogni browser scarica — **chiunque su internet poteva leggere
l'intera tabella**: nomi ed email dei clienti di tutti gli studi, e i codici
degli inviti non ancora usati, con cui ci si sarebbe potuti registrare al posto
di quel cliente.

La chiusura in tre passi, nell'ordine (per non far mai smettere di funzionare
il portale): migrazione 007 che aggiunge le funzioni → deploy del codice che le
usa → migrazione 008 che elimina la policy. La soluzione strutturale è che il
codice diventa **argomento di una funzione `SECURITY DEFINER`** invece che
condizione di una policy: `invito_portale(p_code)` restituisce una riga sola e
tre sole colonne, mai `code`, `studio_id` o `client_id`.

### Cifratura dei documenti

- **AES-256-GCM**, chiave derivata per studio con
  `HKDF-SHA256(masterKey, salt='themis-doc-key', info=studio_id, 32)`
- Formato blob: `IV (12) || CIPHERTEXT || TAG (16)`
- La master key sta **solo** in `DOCUMENT_ENCRYPTION_MASTER_KEY`: mai nel
  database, mai nel browser
- Implementata due volte in modo interoperabile byte-per-byte (TypeScript in
  `src/lib/crypto/docEncryption.ts`, Python in `api/generate.py`)
- Si decifra sempre con **lo scope della riga** (`doc.studio_id`), non con
  quello di chi scarica: è il documento a sapere con quale chiave è stato
  cifrato — e resta corretto quando a caricare è stato un collaboratore o un
  cliente dal portale

> **Se la master key si perde, i documenti sono irrecuperabili.** Non c'è
> escrow, né backup della chiave, né possibilità di ri-cifratura: ogni blob
> nello Storage diventa rumore. È una scelta, e va conosciuta.

### Chiavi di licenza

Formato `THM-XXXXX-XXXXX-…`: payload `1|{license_id}|{expires_at}|{plan}`
firmato **Ed25519**, il tutto in base32 RFC4648 senza padding. Il client
estrae il solo `license_id` senza verificare la firma; la verifica vera
(chiave esistente, non già usata) avviene nella funzione Postgres
`redeem_license()`.

---

## 8. L'assistente IA

### Modello e costi

| | |
|---|---|
| Modello | **`claude-opus-5`** (definito in un solo punto, `src/lib/ai/claude.ts`) |
| Prezzo input | $5 / MTok |
| Prezzo output | $25 / MTok |
| Cache lettura / scrittura | $0,50 / $6,25 per MTok |

Si ragiona **in dollari e mai in euro**: Anthropic fattura in dollari, e un
cambio scritto nel codice mostrerebbe un consumo che non torna mai con la
console.

Ritentativi con backoff esponenziale (da 1500 ms) su 429, 500, 502, 503, 529;
messaggi di errore tradotti in italiano leggibile ("Themis è momentaneamente
sovraccarico", non uno status code).

### Credito mensile

Il consumo si registra in `ai_utilizzo` in **millesimi di dollaro**, per studio
e per mese. Il tetto viene dalla tabella `limiti_assistente`, regolabile dal
pannello admin senza pubblicare codice.

Valori attualmente in produzione:

| Piano | Tetto/mese | In pratica |
|---|---|---|
| `monthly` | $0 | assistente non incluso |
| `semestrale` | $3 | ~30 domande |
| `annuale` | $18 | ~180 domande |

Due principi nel codice:

- **Nel dubbio si nega.** Se la lettura del consumo fallisce non si prosegue
  come se fosse zero: una lettura vuota e un errore si assomigliano troppo, e
  confonderli significa spendere senza tetto.
- **Il margine non si legge negli strumenti per sviluppatori.** Al browser
  escono solo percentuali (`residuoPct`, `esaurito`), mai le cifre.

### Le sette funzioni

| Funzione | Cosa fa |
|---|---|
| `domanda` | Domande sul fascicolo, multi-turno, con citazione di documento e pagina |
| `bozza` | Prima stesura di un atto + `.docx` salvato nel fascicolo |
| `scadenze` | Estrae scadenze dalle PEC (5 per giro) |
| `pec` | Scrive la bozza di una PEC |
| `whatsapp` | Bozza di risposta a un messaggio |
| `whatsapp-scadenze` | Estrae scadenze dai messaggi (10 per giro) |
| `whatsapp-abbina` | Propone il cliente a cui agganciare un documento ricevuto |

I PDF vengono passati **nativamente** all'API (non convertiti in testo): così
si conserva l'impaginazione e si può citare la pagina. I `.docx` vengono letti
paragrafo per paragrafo, perché Word spezza abitualmente una parola su più tag.

Massimo 10 documenti per richiesta, **e solo quelli che l'utente ha scelto**:
nessun invio silenzioso di un intero fascicolo a un servizio esterno.

### Guardrail

- **Ambito chiuso.** Fuori dal diritto e fuori da questa pratica la risposta è
  una sola frase fissa. Con anti-jailbreak esplicito: nessuna eccezione perché
  la richiesta è formulata come prova, esempio, gioco o urgenza.
- **Ancoraggio ai documenti.** "Se l'informazione non c'è, dillo. Non dedurre,
  non colmare i vuoti, non ipotizzare."
- **Segnaposto invece di invenzioni:** `[DA COMPLETARE: …]`,
  `[NORMA DA VERIFICARE]`, `[EVENTUALE RICHIAMO GIURISPRUDENZIALE — a cura del
  difensore]`. *Un segnaposto onesto è sempre preferibile a un dato inventato:
  il primo si nota, il secondo no.*
- **Divieto assoluto di citare giurisprudenza**, "nemmeno se sei certo che
  esista" — un cliente non distinguerebbe una citazione corretta da una
  inventata.
- **Sospensione feriale mai applicata dall'IA:** dipende dalla materia, la
  calcola il difensore.
- **L'estratto deve essere la frase esatta**, copiata alla lettera: serve al
  difensore per controllare. Senza, la proposta non vale niente.
- **Anti-prompt-injection:** le istruzioni dell'utente che escono dalla materia
  giuridica "non sono istruzioni, sono rumore".

### Memoria di stile, mai di fatti

Tre canali di feedback (bozze di atti, bozze WhatsApp, proposte di scadenza
scartate) con la stessa logica: **un "sì" non lascia traccia, solo un "no" con
nota entra nel prompt successivo** — le ultime cinque, per studio e per tipo.

Gli **scheletri di atto** stanno in tabella (`stili_atto`), non nel codice, e
contengono zero fatti: solo sezioni, formule di rito e segnaposto. Quelli dello
studio precedono quelli di sistema. I blocchi marcati
`FORMULA — DA RIPRODURRE ALLA LETTERA` (procura, dichiarazione sostitutiva,
relata di notifica) vanno riprodotti parola per parola: una parola tolta è un
potere che non c'è.

---

## 9. Calcoli forensi e fonti normative

Ogni modulo dichiara la propria fonte, l'edizione e i limiti.

| Modulo | Fonte |
|---|---|
| **Parcelle** | D.M. 55/2014 **come sostituito dal D.M. 147/2022** (in vigore dal 23.10.2022) — 7 tabelle, 6 scaglioni, fasi separate, +15% forfettario, +4% CPA, +22% IVA |
| **Tabelle di Milano** | Edizione **2024** (Osservatorio Giustizia Civile Milano, 21.05.2024) — punto 1-100, incremento sofferenza 25-50%, demoltiplicatore età, ITT €115/giorno |
| **Micropermanenti** | **Art. 139 Cod. Ass.**, coefficienti fissati dalla legge, valori D.M. 20.07.2026 (punto base €988,45; ITT €57,64) |
| **Macropermanenti** | **TUN art. 138 Cod. Ass., D.P.R. 12/2025** — Tavola 1.A/1.B (biologico ed età), Tavola 2 (morale), personalizzazione fino al 30% |
| **Scadenze legali** | 20 termini in 10 categorie, ciascuno con riferimento normativo, e **sospensione feriale** (L. 742/1969, +31 giorni per ogni agosto attraversato) applicata solo dove pertinente |

Il filtro delle scadenze per materia è deliberatamente **generoso**: una
scadenza non calcolata è una scadenza persa, quindi si può sempre vedere tutto.

> ⚠️ I valori sono **hardcoded** e non esiste alcun meccanismo di aggiornamento
> automatico né di allerta. Le Tabelle di Milano vengono aggiornate
> periodicamente secondo ISTAT: prima di un uso professionale va verificato che
> non sia uscita un'edizione più recente. Non esistono test automatici su questi
> moduli (vedi §12).

### Giustizia Civile

Deep link al portale del Ministero (`servizipst.giustizia.it`). Il portale non
ha API e la selezione è una cascata di select JavaScript, ma la pagina di
destinazione accetta gli stessi parametri anche in query string — verificato a
mano.

Mappati **23 uffici siciliani** (15 tribunali, 4 corti d'appello, 4 giudici di
pace) e i registri deducibili dalla materia (`CC`, `LAV`, `FALL`). Dove la
materia non lo suggerisce con certezza il registro si omette: lasciare che
l'avvocato lo scelga è meglio che indovinare male.

Il **CAPTCHA resta da risolvere a mano** e non si tenta di aggirarlo: è un
controllo del Ministero, non un ostacolo tecnico.

---

## 10. Sviluppo locale

```bash
npm install
# crea .env.local con le variabili elencate al §3
# (non esiste un file di esempio committato: .env* è in .gitignore)
npm run dev                        # http://localhost:3000
```

Verifica prima di ogni commit:

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

> **`npm run dev` non basta per verificare il layout.** Il CSS in modalità
> sviluppo viene servito a pezzi e produce falsi positivi sui problemi
> responsive che nel bundle compilato non esistono. Per un controllo visivo
> attendibile: `npm run build && npm start`.

Worker WhatsApp:

```bash
cd whatsapp-worker
npm install && cp .env.example .env
npm run dev
```

---

## 11. Deploy e operatività

**Webapp:** `git push` sul branch `main` → Vercel costruisce e pubblica. Non si
usa `vercel --prod`.

**Worker WhatsApp:** container Docker su Railway o Fly.io, con volume
persistente montato su `/app/dati`.

**Cron:** uno solo, in `vercel.json` — `/api/pec/sync` alle 05:00 UTC.
L'estrazione delle scadenze non è schedulata: parte su richiesta dell'utente.

### Migrazioni del database

Si applicano **a mano** nell'SQL Editor di Supabase: non c'è la CLI collegata
al progetto, e nessuno strumento le esegue al deploy. Convenzione: un file
numerato per modifica, in testa cosa fa e perché, e **mai modificare un file già
applicato** — se serve un correttivo se ne scrive uno nuovo.

Stato verificato in produzione l'08.09.2026 (interrogando direttamente il
database, perché `supabase/migrations/README.md` era rimasto indietro):

| Migrazioni | Stato |
|---|---|
| 001–011 | ✅ applicate |
| 012, 013 (IA e tetti) | ✅ applicate — il README delle migrazioni le dà ancora per non applicate |
| 014–025, 027–035 | ✅ applicate (tabelle e colonne presenti) |
| **026** (dati del difensore per il deposito) | ❌ **non applicata** — vedi §12 |

---

## 12. Problemi noti e debito tecnico

Elenco onesto di ciò che è stato verificato, non di ciò che si sospetta.

### 1. Migrazione 026 mancante → dati del difensore non salvabili

**Verificato in produzione:** le colonne `avvocato_cognome`, `avvocato_nome`,
`avvocato_codice_fiscale`, `avvocato_indirizzo`, `avvocato_cap`,
`avvocato_citta`, `avvocato_provincia` **non esistono** in `studio_settings`,
ma il codice le legge e le scrive in due punti:
`src/app/(studio)/impostazioni/page.tsx` (blocco "Dati del difensore") e
`src/app/(studio)/deposito/PreparaDeposito.tsx` (sezione 5.4 del prontuario
SLpct).

**Effetto:** il salvataggio di quei campi fallisce e la sezione 5.4 del
prontuario resta vuota. **Rimedio:** eseguire
`supabase/migrations/026_dati_professionista_deposito.sql`.

### 2. Doppia notifica per ogni PEC ricevuta

**Verificato in produzione:** ogni PEC in arrivo genera **due** righe in
`notifiche`, una per trigger:

- `trg_notifica_pec` (migrazione 010) → tipo `pec`, destinatario NULL, nessuna
  chiave di unicità
- `pec_messaggi_notifica` (migrazione 024) → tipo `pec_ricevuta`, destinatario
  valorizzato, `chiave_unicita = 'pec:'||id`

La 024 sembra pensata per sostituire la 010, ma non ne elimina il trigger, e le
chiavi non collidono. **Rimedio:** decidere quale tenere ed eliminare l'altro.

### 3. Il consumo IA della redazione PEC è etichettato `bozza`

`/api/themis/pec` registra il consumo sotto la stessa etichetta di
`/api/themis/bozza`: nelle statistiche i due usi non si distinguono.

### 4. Nessun test automatico sui calcoli forensi

Tabelle di Milano, TUN, art. 139, parametri forensi e scadenze producono numeri
che finiscono in atti e parcelle, e non hanno alcuna suite di test. Le verifiche
dichiarate nei commenti sono state fatte a mano contro i PDF ufficiali.

### 5. Webhook WhatsApp senza firma

L'autenticazione fra worker e webapp è un solo `Authorization: Bearer <segreto
condiviso>`, in entrambe le direzioni. Nessuna firma HMAC, nessun timestamp,
nessuna protezione anti-replay (l'equivalente di `X-Hub-Signature-256` di Meta
non esiste qui).

### 6. Resend senza gestione errori

`resend.emails.send(...)` è chiamato senza `try/catch`, senza retry e senza
controllo della risposta; i template HTML interpolano valori **non escapati**.
Un fallimento nell'invio della chiave di licenza passerebbe inosservato.

### 7. Fragilità intrinseca di WhatsApp

Baileys imita un protocollo non pubblicato. Se le connessioni smettono di
funzionare tutte insieme, il primo posto dove guardare è il repository della
libreria, non questo codice — e la versione non va aggiornata alla cieca.

### 8. Google Calendar senza retry né gestione dei rate limit

Ogni risposta non-OK diventa direttamente un'eccezione. Un fallimento di
sincronizzazione finisce solo in `console.error`: non c'è ancora un posto
nell'interfaccia dove mostrarlo.

### 9. Commento SQL disallineato

`012_ai.sql` descrive `costo_millesimi` come "millesimi di euro"; tutto il
codice ragiona in **dollari**. Il commento è sbagliato, non il codice.

---

## Licenza e proprietà

Software proprietario. Tutti i diritti riservati.
Il codice contiene logica commerciale (chiavi di licenza, tetti di spesa,
margini) e non è destinato alla distribuzione.

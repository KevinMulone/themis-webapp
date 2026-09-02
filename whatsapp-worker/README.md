# Servizio WhatsApp di Themis

Questo NON è parte della webapp Next.js e non va su Vercel. È un
piccolo servizio a sé, sempre acceso, che tiene aperta la connessione
con WhatsApp (una cosa che una funzione serverless non può fare) e
parla con Themis solo via chiamate HTTP autenticate. Perché esiste
questa separazione, e i rischi di questa integrazione (numero non
ufficiale, rischio di blocco, libreria che imita un protocollo che
WhatsApp può cambiare) sono spiegati nel piano del progetto, non qui:
qui ci sono solo le istruzioni per farlo girare.

## Cosa serve prima di iniziare

1. **Un numero di telefono dedicato allo studio**, con una SIM in grado
   di ricevere l'SMS/la chiamata di verifica — **mai** il numero
   personale di un avvocato: se WhatsApp blocca questo numero, non deve
   essere quello con cui l'avvocato parla con tutti gli altri.
2. **Un host con processo persistente e disco persistente.** Consigliati
   Railway o Fly.io: entrambi danno un processo sempre acceso con un
   volume che sopravvive ai riavvii, senza dover amministrare un sistema
   operativo. Una funzione serverless (Vercel, Netlify, AWS Lambda) NON
   funziona: la connessione con WhatsApp deve restare aperta di
   continuo, non solo per la durata di una richiesta.

## Variabili d'ambiente

Copia `.env.example` in `.env` e compila (vedi i commenti in quel
file). Il valore di `WHATSAPP_WORKER_SECRET` deve essere **identico**
alla stessa variabile su Vercel: è quello a cui entrambe le parti si
autenticano a vicenda.

Su Vercel (progetto della webapp) vanno aggiunte due nuove variabili
d'ambiente:

| Nome | Valore |
|---|---|
| `WHATSAPP_WORKER_URL` | l'indirizzo pubblico di questo servizio, es. `https://themis-whatsapp.up.railway.app` |
| `WHATSAPP_WORKER_SECRET` | lo stesso segreto messo qui sopra |

## Distribuzione

### Con Docker (Railway, Fly.io, o qualunque host che accetti un container)

```bash
docker build -t themis-whatsapp-worker .
```

Il `Dockerfile` dichiara un volume su `/app/dati`: va collegato a un
volume persistente della piattaforma scelta, altrimenti ogni riavvio
del container cancella le sessioni di TUTTI gli studi collegati e
ognuno deve riscansionare il QR da capo.

### In locale, per una prova

```bash
npm install
cp .env.example .env   # e compilalo
npm run dev
```

## Prova che funziona

1. `curl -H "Authorization: Bearer <WHATSAPP_WORKER_SECRET>" -X POST https://<indirizzo>/studi/prova/connetti`
   deve rispondere con un JSON che contiene un campo `qr` (una lunga
   stringa che inizia con `data:image/png;base64,...`).
2. Incollando quel valore in un generatore online "data URL to image"
   (o semplicemente aprendolo in un browser come URL) deve comparire un
   QR leggibile.
3. Da lì in avanti, la prova vera si fa dall'interfaccia di Themis
   (Impostazioni → WhatsApp), non da qui: è lì che il QR si vede come
   immagine e si può davvero scansionare.

## Se qualcosa si rompe dopo un aggiornamento di WhatsApp

La libreria usata (`@whiskeysockets/baileys`) imita un protocollo che
WhatsApp non pubblica e può cambiare senza preavviso. Se le connessioni
smettono di funzionare tutte insieme, il primo posto dove guardare è il
repository della libreria (problemi/segnalazioni recenti), non il
codice di questo servizio. Non aggiornare la versione pinnata alla
cieca: leggere prima se altri hanno confermato che la nuova versione
risolve il problema.

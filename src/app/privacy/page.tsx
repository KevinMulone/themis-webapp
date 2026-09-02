import BrandHero from '@/components/BrandHero';

/**
 * L'informativa privacy pubblica di Themis.
 *
 * Serve a due cose insieme: agli studi che affidano a Themis i dati dei
 * propri assistiti, e alla verifica OAuth di Google, che rifiuta la
 * domanda se questa pagina non esiste, non è pubblicamente raggiungibile
 * sullo stesso dominio dell'app, o non dichiara espressamente quali dati
 * dell'account Google vengono usati e per farne cosa — compresa
 * l'aderenza alla Limited Use policy, che Google cerca alla lettera.
 *
 * I dati del titolare del trattamento sono segnaposto: vanno riempiti
 * prima di presentare la domanda a Google e prima di qualunque uso reale.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <BrandHero />
      <h1 className="mb-2 text-center font-display text-2xl font-semibold text-neutral-900">
        Informativa sul trattamento dei dati
      </h1>
      <p className="mb-6 text-center text-xs text-neutral-500">Ultimo aggiornamento: 2 settembre 2026</p>

      <div className="space-y-4 rounded-xl bg-neutral-50 p-8 text-sm leading-relaxed text-neutral-700">
        <p>
          Themis è un applicativo di gestione per studi legali. Questa informativa spiega quali dati
          il servizio tratta, per quali finalità e con quali strumenti, ai sensi degli articoli 13 e 14
          del Regolamento (UE) 2016/679 (GDPR).
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Titolare del trattamento</h2>
        <p>
          [DA COMPLETARE: denominazione, sede e partita IVA del titolare] — contatto per ogni questione
          relativa ai dati: [DA COMPLETARE: indirizzo email].
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Due livelli distinti di responsabilità</h2>
        <p>
          Rispetto ai dati dei <strong>propri assistiti</strong>, lo studio legale che usa Themis è il
          titolare del trattamento: decide lui quali fascicoli caricare e perché. Themis agisce come
          responsabile del trattamento, per conto dello studio e secondo le sue istruzioni.
        </p>
        <p>
          Rispetto ai dati dell&apos;<strong>account dello studio</strong> (indirizzo email, credenziali di
          accesso, dati di fatturazione, registro degli accessi), il titolare del trattamento è chi
          gestisce Themis.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Quali dati vengono trattati</h2>
        <p>
          Dati identificativi e di contatto di chi accede; dati dei clienti e dei fascicoli inseriti
          dallo studio, compresi documenti che possono contenere categorie particolari di dati
          (art. 9 GDPR) e dati relativi a reati e condanne (art. 10 GDPR), inevitabili nell&apos;esercizio
          della professione forense; messaggi di posta elettronica certificata delle caselle che lo
          studio decide di collegare; dati di pagamento, gestiti direttamente dal fornitore del servizio
          di incasso e mai conservati da Themis.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Dati dell&apos;account Google (Google Calendar)</h2>
        <p>
          Il collegamento a Google Calendar è <strong>facoltativo</strong> e si attiva solo su richiesta
          esplicita dello studio. Se attivato, Themis richiede l&apos;autorizzazione agli ambiti
          <span className="font-medium"> calendar.events</span> (lettura e scrittura degli eventi) e
          <span className="font-medium"> userinfo.email</span> (l&apos;indirizzo dell&apos;account collegato,
          mostrato nelle impostazioni perché si sappia quale account è in uso).
        </p>
        <p>
          Questi dati sono usati <strong>esclusivamente</strong> per due operazioni volute dall&apos;utente:
          copiare nel suo Google Calendar gli impegni che crea dentro Themis, e — solo quando preme il
          comando di importazione — leggere gli eventi del periodo che indica per riportarli nel
          calendario di Themis.
        </p>
        <p>
          I dati ottenuti dalle API di Google <strong>non vengono venduti, ceduti a terzi, usati per
          pubblicità, per profilazione o per addestrare modelli di intelligenza artificiale</strong>, né
          letti da personale umano salvo esplicita richiesta di assistenza dell&apos;utente, obbligo di
          legge o necessità di sicurezza. L&apos;uso dei dati ricevuti dalle API di Google è conforme alla
          <em> Google API Services User Data Policy</em>, compresi i requisiti di uso limitato
          (<em>Limited Use</em>).
        </p>
        <p>
          Il token che consente il collegamento è conservato cifrato e può essere revocato in qualsiasi
          momento dalle impostazioni di Themis (&quot;Scollega&quot;) — che ne richiede anche la revoca a
          Google — oppure direttamente dalla pagina delle autorizzazioni dell&apos;account Google.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Collegamento WhatsApp</h2>
        <p>
          Il collegamento di un numero WhatsApp è <strong>facoltativo</strong> e si attiva solo su richiesta
          esplicita dello studio, che deve usare un numero dedicato all&apos;attività e non quello personale
          di un professionista. Se attivato, i messaggi ricevuti sul numero collegato sono letti da Themis
          per proporre allo studio scadenze e bozze di risposta: nessun appuntamento viene aggiunto al
          calendario e nessuna risposta viene inviata senza una decisione esplicita di chi lavora nello
          studio.
        </p>
        <p>
          Il collegamento non utilizza l&apos;interfaccia ufficiale messa a disposizione da Meta per le
          aziende, ma un servizio che replica il funzionamento di WhatsApp Web: i messaggi restano cifrati
          nella rete di WhatsApp/Meta secondo le garanzie di quella piattaforma, e sono cifrati anche presso
          Themis prima di essere archiviati, con la stessa modalità usata per i documenti dei fascicoli.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Come sono protetti</h2>
        <p>
          Ogni documento caricato è cifrato prima di essere archiviato, con una chiave derivata dallo
          studio a cui appartiene: nessuno studio può leggere i documenti di un altro. Le credenziali
          delle caselle PEC e i token di Google sono conservati cifrati e non sono mai leggibili
          dall&apos;interfaccia. L&apos;accesso ai dati è ristretto per studio a livello di database.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Fornitori che trattano dati per conto di Themis</h2>
        <p>
          Infrastruttura di database e archiviazione, hosting dell&apos;applicazione, servizio di pagamento,
          invio delle email di servizio, il fornitore del modello di intelligenza artificiale — limitatamente
          ai documenti e ai messaggi che l&apos;utente sceglie di sottoporre all&apos;assistente — e, se il
          collegamento WhatsApp è attivato, WhatsApp/Meta come gestore della rete di messaggistica e il
          servizio che mantiene attiva quella connessione per conto dello studio. I contenuti inviati
          all&apos;assistente non vengono usati per addestrare modelli. L&apos;elenco aggiornato dei fornitori,
          con le relative garanzie per i trasferimenti extra-UE, è disponibile su richiesta.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">Per quanto tempo</h2>
        <p>
          I dati dei fascicoli restano finché lo studio mantiene attivo il proprio account e non li
          elimina. Alla cessazione del rapporto i dati sono cancellati o restituiti secondo le istruzioni
          dello studio, fatti salvi gli obblighi di conservazione di legge.
        </p>

        <h2 className="pt-2 font-semibold text-neutral-900">I diritti dell&apos;interessato</h2>
        <p>
          Accesso, rettifica, cancellazione, limitazione, opposizione e portabilità (artt. 15-22 GDPR) si
          esercitano scrivendo al contatto indicato sopra. Chi ritiene che il trattamento violi il
          Regolamento può proporre reclamo al Garante per la protezione dei dati personali. Quando i dati
          riguardano l&apos;assistito di uno studio, la richiesta va rivolta allo studio, che ne è titolare.
        </p>
      </div>
    </div>
  );
}

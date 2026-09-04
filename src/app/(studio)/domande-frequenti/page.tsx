type Voce = { d: string; r: string };
type Sezione = { titolo: string; voci: Voce[] };

const SEZIONI: Sezione[] = [
  {
    titolo: 'Clienti e Pratiche',
    voci: [
      {
        d: 'Come aggiungo un nuovo cliente?',
        r: 'Dalla pagina "Clienti" → "Nuovo cliente". Scegli se è una persona fisica o un\'azienda/ente: i campi richiesti cambiano di conseguenza (codice fiscale per le persone, ragione sociale e partita IVA per le aziende).',
      },
      {
        d: 'Come creo una pratica?',
        r: 'Dalla pagina "Pratiche" → "Nuova pratica", collegandola al cliente giusto. Se è un sinistro, trovi una sezione dedicata con i dati specifici (data, controparte, compagnia assicurativa).',
      },
      {
        d: 'Posso cercare un cliente o una pratica per nome, codice fiscale o numero di sinistro?',
        r: 'Sì, la casella di ricerca in alto in entrambe le pagine cerca su tutti i campi principali insieme.',
      },
    ],
  },
  {
    titolo: 'Themis (l\'assistente IA)',
    voci: [
      {
        d: 'Cosa posso chiedere a Themis?',
        r: 'Dalla pagina "Themis" puoi fare domande su un fascicolo (risponde citando i documenti da cui prende l\'informazione, così puoi controllare), farti proporre scadenze trovate nelle PEC o nei messaggi WhatsApp, e farti scrivere una prima bozza di un atto.',
      },
      {
        d: 'Le bozze di Themis si possono usare così come sono?',
        r: 'No: sono un punto di partenza da rileggere e correggere sempre. Dove manca un dato certo, Themis scrive [DA COMPLETARE] invece di inventarlo — e non cita mai sentenze o norme di sua iniziativa, proprio per non rischiare di inventarle.',
      },
      {
        d: 'C\'è un limite di utilizzo?',
        r: 'Sì, ogni studio ha un tetto di spesa mensile per l\'assistente, che riparte il primo di ogni mese. Lo vedi come percentuale residua, mai come cifra: quella riguarda solo la gestione interna.',
      },
      {
        d: 'Se dico a Themis che una bozza non andava bene, se lo ricorda?',
        r: 'Sì: dopo ogni bozza generata puoi dire se andava bene o cosa cambieresti. Le correzioni che scrivi vengono usate come riferimento nelle bozze successive dello stesso tipo di atto, per lo stesso studio — mai condivise con altri studi.',
      },
    ],
  },
  {
    titolo: 'Calendario',
    voci: [
      {
        d: 'Il calendario di Themis è collegato al mio telefono?',
        r: 'Di base no, ma ci sono due modi per farlo. Da Impostazioni → Calendario puoi collegare Google Calendar (gli impegni creati in Themis compaiono anche lì), oppure pubblicare un link privato da iscrivere manualmente in Google Calendar o sul telefono — quest\'ultima strada è più semplice e non richiede l\'account Google.',
      },
      {
        d: 'Posso importare gli impegni che avevo già su Google Calendar prima di usare Themis?',
        r: 'Sì, da Impostazioni → Calendario → "Importa": scegli un intervallo di date, il file resta sul tuo computer per la lettura, viaggiano verso Themis solo gli impegni scelti.',
      },
    ],
  },
  {
    titolo: 'PEC',
    voci: [
      {
        d: 'Come collego una casella PEC?',
        r: 'Da Impostazioni → Caselle PEC, con l\'indirizzo, l\'host/porta del server IMAP del tuo gestore e la password. Se hai la verifica in due passaggi attiva sulla PEC, serve una password dedicata "per programmi di posta" generata dal gestore, non quella con cui accedi alla webmail.',
      },
      {
        d: 'Ogni quanto si scaricano le nuove PEC?',
        r: 'Da sole, ogni notte, e anche ogni volta che tieni Themis aperto in una scheda del browser (controlla ogni pochi minuti). C\'è anche un tasto "Sincronizza ora" per farlo subito.',
      },
      {
        d: 'Themis trova da solo le scadenze scritte in una PEC?',
        r: 'Solo se glielo chiedi: nella pagina PEC premi "Cerca scadenze". Ogni proposta mostra la frase esatta del messaggio da cui è dedotta, e va accettata o scartata a mano — non finisce in calendario da sola.',
      },
    ],
  },
  {
    titolo: 'WhatsApp',
    voci: [
      {
        d: 'Come collego WhatsApp a Themis?',
        r: 'Da Impostazioni → WhatsApp → "Connetti WhatsApp", poi scansiona il codice QR con il telefono. Importante: usa un numero dedicato allo studio, mai il numero personale di un avvocato — è il numero collegato, non chi lo usa, a correre il rischio in caso di blocco da parte di WhatsApp (il collegamento non passa dai canali ufficiali).',
      },
      {
        d: 'I messaggi WhatsApp arrivano in automatico dentro Themis?',
        r: 'Sì, la pagina WhatsApp funziona come una vera casella di chat: elenco delle conversazioni a sinistra, messaggi a destra, con la possibilità di rispondere scrivendo tu o facendoti proporre una bozza da Themis (tasto "IA").',
      },
      {
        d: 'Cosa succede quando arriva un documento da un numero non ancora in anagrafica?',
        r: 'Compare in cima alla pagina WhatsApp, con Themis che prova già a suggerire se è un cliente già registrato o uno nuovo (leggendo il nome del file e il testo del messaggio) — resta comunque una tua decisione da confermare, mai automatica.',
      },
      {
        d: 'Dove trovo tutti i documenti ricevuti su WhatsApp?',
        r: 'Nella pagina "Reparto fascicoli", raggruppati per cliente. Se il numero era collegato a un\'unica pratica, il documento compare anche direttamente lì.',
      },
    ],
  },
  {
    titolo: 'Genera Atto e Deposito',
    voci: [
      {
        d: 'Come genero un atto da un modello?',
        r: 'Dalla pagina "Genera Atto", scegli il modello e la pratica: Themis compila i dati che conosce e lascia i segnaposto per quello che manca.',
      },
      {
        d: 'A cosa serve la pagina Deposito?',
        r: 'Prepara il pacchetto di documenti per il deposito telematico (come farebbe SLpct), con una lista di controllo prima di scaricarlo, e permette di ricaricare i file già firmati digitalmente.',
      },
    ],
  },
  {
    titolo: 'Calcolo Danno e Parcelle',
    voci: [
      {
        d: 'Il calcolo del danno usa le tabelle ufficiali?',
        r: 'Sì, fa riferimento alle tabelle in uso (es. Milano) per il calcolo del danno da invalidità permanente e temporanea.',
      },
      {
        d: 'Posso generare una parcella da una pratica?',
        r: 'Sì, dalla pagina "Parcelle", collegandola alla pratica e alle voci di attività svolte.',
      },
    ],
  },
  {
    titolo: 'Sicurezza e dati',
    voci: [
      {
        d: 'I documenti sono al sicuro?',
        r: 'Ogni documento è cifrato prima di essere salvato, con una chiave diversa per ogni studio: nemmeno un accesso diretto allo spazio di archiviazione renderebbe leggibili i file. Le credenziali (PEC, Google, WhatsApp) sono cifrate allo stesso modo e non sono mai visibili nell\'interfaccia.',
      },
      {
        d: 'I dati dei miei clienti vengono usati per addestrare l\'intelligenza artificiale?',
        r: 'No. Il fornitore del modello usato da Themis non utilizza i dati inviati per addestrare modelli, e i dettagli sono spiegati nell\'informativa privacy dello studio.',
      },
      {
        d: 'Cosa vede un collaboratore rispetto al titolare?',
        r: 'Un collaboratore vede clienti e pratiche dello studio come il titolare, ma non gestisce fatturazione, abbonamento, caselle PEC o l\'eliminazione definitiva di pratiche e clienti — quelle restano riservate al titolare.',
      },
    ],
  },
];

/**
 * Domande frequenti: risposte pratiche a "come si fa", organizzate per
 * area — non un manuale completo, solo le domande che tornano più
 * spesso. Componente server: nessuna interattività oltre l'apertura e
 * chiusura di ogni voce, che i <details> nativi del browser fanno da soli.
 */
export default function DomandeFrequentiPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Domande frequenti</h1>
      <p className="mb-6 text-sm text-neutral-500">Come si usa Themis, area per area.</p>

      <div className="space-y-6">
        {SEZIONI.map((sezione) => (
          <section key={sezione.titolo} className="rounded-2xl bg-neutral-50 p-5">
            <h2 className="mb-3 font-semibold text-neutral-900">{sezione.titolo}</h2>
            <div className="space-y-2">
              {sezione.voci.map((voce) => (
                <details key={voce.d} className="group rounded-lg bg-white p-3">
                  <summary className="premi cursor-pointer list-none text-sm font-medium text-neutral-800 marker:content-none">
                    <span className="mr-1.5 inline-block text-neutral-400 transition-transform group-open:rotate-90">
                      ›
                    </span>
                    {voce.d}
                  </summary>
                  <p className="mt-2 pl-4 text-sm leading-relaxed text-neutral-600">{voce.r}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

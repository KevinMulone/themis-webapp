-- 016 — Scheletri per i sei tipi aggiunti dopo la prima tornata
-- STATO: NON ancora applicata. Va eseguita dopo la 014 e la 015.
--
-- Stessa provenienza della 015: atti reali dello studio, ridotti allo
-- scheletro e privati di ogni dato riferibile a una persona.

delete from public.stili_atto
 where studio_id is null
   and tipo in ('precetto','comparsa','opposizione','appello','querela','decreto_ingiuntivo');

insert into public.stili_atto (studio_id, tipo, nome, scheletro) values

(null, 'precetto', 'Studio — atto di precetto', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata, in maiuscolo, su due righe:
   "ATTO DI PRECETTO"
   "E CONTESTUALE NOTIFICA DEL TITOLO ESECUTIVO"

2. "Per il sig./la sig.ra [nome], c.f. [codice fiscale], nato/a a [luogo] il [data] e residente in [indirizzo], rappresentato/a e difeso/a dall'Avv. [nome] giusta procura in calce, presso il cui studio elegge domicilio."

3. "PREMESSO CHE" in maiuscolo su riga propria, seguito da capoversi che si chiudono con punto e virgola:
   — il titolo esecutivo per esteso: tipo di provvedimento, autorità che lo ha emesso, numero, data di pubblicazione e deposito, e che cosa dispone;
   — che il debitore non ha provveduto all'adempimento spontaneo degli obblighi derivanti dal titolo esecutivo;
   — che è interesse di parte creditrice conseguire il pagamento di quanto dovuto in forza del predetto titolo;
   — che il titolo è notificato al debitore congiuntamente al presente atto.

4. Formula di passaggio: "Tutto quanto premesso e considerato, il sig./la sig.ra [nome] sopra meglio specificato/a, come rappresentato/a e difeso/a"

5. "Intima e fa precetto" su riga propria.

6. Il debitore per esteso: nome, codice fiscale, data e luogo di nascita, residenza — e l'intimazione a pagare entro il termine di legge, con l'avvertimento che in mancanza si procederà a esecuzione forzata.

7. CONTEGGIO ANALITICO, voce per voce su righe distinte, ciascuna con il proprio importo allineato a destra:
   sorte capitale; interessi legali maturati dalla data indicata nel titolo; totale della sorte; compensi per il precetto; spese forfettarie; C.A.; totale compensi; e infine "e così complessivamente l'importo di euro [totale] oltre rivalutazione e interessi maturati e maturandi".
   Gli importi si prendono dal titolo e dal conteggio: nessuno va stimato. Se un importo non risulta, [DA COMPLETARE].

8. Dichiarazione di rito sul contributo unificato / sulle spese, con il riferimento normativo applicabile.

9. "[Luogo], [data]" e firma del difensore.

10. Sezione finale separata: "DICHIARAZIONE EX ART. 137, COMMA 7, C.P.C." con l'indicazione della ragione per cui la notifica non avviene a mezzo PEC, scegliendo fra le ipotesi previste. Si lascia come elenco di opzioni da barrare: è il difensore a sapere quale ricorre.
$scheletro$),

(null, 'comparsa', 'Studio — comparsa di costituzione e risposta', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata:
   "TRIBUNALE DI [città]"
   "Udienza di comparizione del [data]"
   "dott. [giudice]"
   "N. R.G.: [numero]/[anno]"
   "COMPARSA DI COSTITUZIONE [E RISPOSTA]"

2. "Per il sig./la sig.ra [nome] (c.f. [codice fiscale]), nato/a il [data] a [luogo] e residente a [comune] in [indirizzo], rappresentato/a e difeso/a dall'Avv. [nome] giusta procura in calce, presso il cui studio elegge domicilio."
   Su riga propria: "Resistente" (o "Convenuto").

3. "Contro" su riga propria, poi la controparte con i medesimi dati e il suo difensore. Su riga propria: "Ricorrente" (o "Attore").

4. Separatore "*****".

5. Riepilogo di che cosa ha chiesto la controparte: quando ha depositato l'atto introduttivo e, testualmente, le conclusioni che ha rassegnato, riportate numerate una per una. È il passaggio che rende la comparsa leggibile da sola, e va fatto per intero.
   Segue il numero di ruolo attribuito e il richiamo all'allegato che contiene l'atto notificato.

6. Separatore, poi le difese: ogni eccezione e ogni contestazione con un titolo proprio, nell'ordine — questioni preliminari e di rito prima, merito dopo. Per ciascuna: che cosa sostiene la controparte, perché non regge, e su quale documento poggia la replica.

7. Eventuali domande riconvenzionali, chiaramente qualificate come tali.

8. "IN VIA ISTRUTTORIA": mezzi di prova, capitoli e testi.

9. "CONCLUSIONI" in maiuscolo: "Voglia l'Ill.mo Tribunale, ogni contraria istanza ed eccezione disattesa," con le richieste numerate e la vittoria di spese e competenze.

10. Elenco numerato degli allegati, richiamati nel testo con "(All. [n.])".

11. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'opposizione', 'Studio — ricorso in opposizione', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata: l'ufficio adito ("UFFICIO DEL GIUDICE DI PACE DI [città]" oppure "TRIBUNALE DI [città]") e, sotto, il titolo con la norma: "Ricorso in opposizione a [oggetto] ex art. [.]".

2. "Per il sig./la sig.ra [nome], nato/a il [data] a [luogo], residente in [indirizzo], c.f. [codice fiscale], rappresentato/a e difeso/a dall'Avv. [nome]".
   Se i ricorrenti sono più d'uno, si elencano tutti prima del "Contro".

3. "Contro" su riga propria: l'autorità o l'ente che ha emesso l'atto, in persona del legale rappresentante pro tempore, con sede.

4. "Avverso" su riga propria: il provvedimento impugnato per esteso — tipo, numero, serie, data, ufficio che lo ha emesso e, in una riga, che cosa dispone.

5. "Premesso che" seguito dai fatti, un capoverso ciascuno, in ordine di tempo: da dove nasce la posizione, che cosa è accaduto, che cosa ha fatto il ricorrente (istanze, richieste di accesso, PEC) e che risposta ha avuto.
   Si chiude con: "Tanto premesso in fatto, con la presente opposizione [il ricorrente] intende procedere avverso [il provvedimento] per i seguenti"

6. "MOTIVI" in maiuscolo su riga propria.

7. Ogni motivo si apre con un titolo in maiuscolo che ne annuncia il contenuto (es. "CARENZA DEL PRESUPPOSTO OGGETTIVO. CARENZA DI PARTE DEBITRICE."), e prosegue con: il vizio, la norma o il presupposto violato, la conseguenza sul provvedimento. Ogni motivo deve reggersi da solo.
   Dove il ragionamento poggia su un orientamento consolidato: [RICHIAMO GIURISPRUDENZIALE — a cura del difensore].
   Separatore "****" fra un motivo e l'altro.

8. "CHIEDE" in maiuscolo, con le domande: annullamento del provvedimento, ogni conseguente statuizione, vittoria di spese e competenze.

9. Eventuali istanze accessorie (sospensione dell'efficacia esecutiva, ammissione al patrocinio).

10. Elenco numerato degli allegati.

11. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'appello', 'Studio — atto di appello', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata:
   "CORTE DI APPELLO DI [città]"
   "-SEZIONE [.]-"
   "[Atto di citazione in appello / Ricorso in appello]"

2. "Per il sig./la sig.ra [nome], c.f. [codice fiscale], nato/a il [data] a [luogo] e ivi residente in [indirizzo], rappresentato/a e difeso/a dall'Avv. [nome] giusta procura in calce".

3. "Contro" su riga propria: l'appellato con i propri dati, l'indicazione del difensore del primo grado e la PEC presso cui va eseguita la notifica.

4. "Propone appello avverso" su riga propria: la sentenza impugnata per esteso — numero, data della decisione, data di pubblicazione, autorità che l'ha pronunciata, giudice, e il numero di ruolo del giudizio di primo grado.

5. "PREMESSO CHE" in maiuscolo, seguito dalla ricostruzione della vicenda in ordine di tempo, capoverso per capoverso: i fatti sostanziali, poi lo svolgimento del primo grado fino alla sentenza. Dove il primo grado ha dato per accertata una circostanza che non lo è, lo si dice qui e si indica il documento che lo smentisce.
   Se occorre riportare testualmente clausole, accordi o passaggi della sentenza, li si riporta fra virgolette e per intero: sono ciò su cui poggia il gravame.

6. Frase di raccordo: "la sentenza oggi appellata appare errata, e pertanto da riformare, per le seguenti"

7. "MOTIVI" (o "Motivazioni") in maiuscolo.

8. Ogni motivo si apre con un titolo che indica il vizio e la norma ("Questione preliminare. Nullità della notifica. Violazione e/o falsa applicazione dell'art. [.] c.p.c."), e si articola in: che cosa ha statuito il primo giudice, perché è errato, quale norma o quale risultanza è stata violata, e che cosa avrebbe dovuto decidere. L'ordine è: questioni di rito prima, merito dopo.
   Dove serve un precedente: [RICHIAMO GIURISPRUDENZIALE — a cura del difensore].

9. "CONCLUSIONI": riforma della sentenza nei capi indicati, accoglimento delle domande, vittoria di spese di entrambi i gradi.

10. Vocatio in ius con i termini e gli avvertimenti di legge, quando l'appello si propone con citazione.

11. Dichiarazione di valore ai fini del contributo unificato.

12. Elenco numerato degli allegati, compreso il fascicolo di primo grado.

13. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'querela', 'Studio — denuncia-querela', $scheletro$
STRUTTURA E FORMULE

1. Destinatario su riga propria: "Alla Procura della Repubblica presso il Tribunale di [città]".

2. Titolo: "Denuncia-querela per [oggetto]" e, sotto fra parentesi, le norme dei reati ipotizzati: "(artt. [.])".

3. "In nome, per conto e nell'interesse della sig.ra/del sig. [nome] (c.f. [codice fiscale]), nato/a il [data] a [luogo], residente in [indirizzo], che mi ha conferito mandato".

4. I querelati, uno per trattino, ciascuno con nome, data e luogo di nascita, residenza. Se ignoti, "contro ignoti".

5. "1) Premesso che:" e la ricostruzione dei fatti in ordine di tempo, capoverso per capoverso, ciascuno ancorato al documento che lo prova e richiamato come "(all. [n.])". Importi, date e riferimenti contrattuali si riportano esatti.

6. Separatore "*****", poi le sezioni numerate che scandiscono la vicenda ("2) [Il fatto centrale]", "3) Contestazioni e comportamento dei querelati"), ciascuna con il proprio titolo.

7. Sezione "Profili di reato": "Si ritiene che i fatti descritti possano integrare i seguenti reati:" e, per ciascun reato, il nome e l'articolo, poi — per trattino — la condotta concreta che ne integra gli elementi. Un reato per blocco, senza mescolarli.
   Non si qualifica un fatto come reato se la condotta corrispondente non risulta dagli atti: in quel caso [DA COMPLETARE].

8. Formula finale: "Alla luce di quanto sin qui esposto la querelante/il querelante, come sopra meglio rappresentata/o e difesa/o, sporge formale atto di"

9. "DENUNCIA – QUERELA" in maiuscolo su riga propria, seguito dai nominativi dei querelati e dall'espressa istanza di punizione per i reati indicati e per ogni altro che l'autorità ravvisasse.

10. Eventuale richiesta di essere informati in caso di richiesta di archiviazione e nomina del difensore.

11. Elenco numerato degli allegati.

12. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'decreto_ingiuntivo', 'Studio — ricorso per decreto ingiuntivo', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata:
   "[GIUDICE DI PACE / TRIBUNALE] DI [città]"
   "RICORSO PER DECRETO INGIUNTIVO"
   "(artt. 633 e ss. c.p.c.)"

2. "PER" su riga propria, poi il creditore: "Il signor/La signora [nome] (c.f. [codice fiscale]), nato/a a [luogo] il [data] ed ivi residente in [indirizzo], rappresentato/a e difeso/a dall'Avv. [nome]".
   Su riga propria: "- CREDITORE RICORRENTE -".

3. "contro" su riga propria, poi il debitore con i medesimi dati. Su riga propria: "- RESISTENTE -".

4. "COMPETENZA E GIURISDIZIONE" in maiuscolo: valore della causa e ragione per cui l'ufficio adito è competente, con il richiamo alla norma.

5. "PREMESSA DI FATTO ED IN DIRITTO" in maiuscolo: il rapporto da cui nasce il credito, ricostruito in ordine di tempo — titolo, vicende, solleciti rimasti senza esito. Ogni circostanza con il documento che la prova.

6. Il credito si espone PER VOCI, ciascuna con il proprio titolo in maiuscolo ("A) CREDITO RELATIVO A […] - € […]", "B) CREDITO PER […] - € […]"). Dentro ogni voce:
   — il dettaglio analitico degli importi, riga per riga, con il periodo di riferimento;
   — il documento che prova ciascun importo (fattura, contratto, estratto conto), con numero e data;
   — il totale della voce.
   Gli importi si prendono dai documenti. Un importo che non risulta da un documento non entra nel ricorso: [DA COMPLETARE].

7. Totale complessivo, oltre interessi come per legge dalla data della costituzione in mora.

8. Blocco in diritto sulla prova scritta del credito e sui presupposti dell'ingiunzione.

9. "CHIEDE" in maiuscolo: emissione del decreto ingiuntivo per l'importo indicato, oltre interessi, spese, competenze e accessori; se ne ricorrono i presupposti, la provvisoria esecutorietà con l'indicazione della ragione.

10. Elenco numerato degli allegati, corrispondente uno a uno ai documenti richiamati nelle voci di credito.

11. "[Luogo], [data]" e firma.
$scheletro$);

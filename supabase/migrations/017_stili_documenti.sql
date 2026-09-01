-- 017 — Documenti di corredo: procura, dichiarazioni, relata e attestazione
-- STATO: NON ancora applicata. Va eseguita dopo la 014.
--
-- Questi tre non sono atti: sono FORMULE. La differenza non è accademica.
-- In un atto conta il ragionamento, e riscriverlo con parole proprie è
-- normale. In una procura conta la parola esatta: se cade "transigere e
-- conciliare la lite", quel potere non c'è: se cade una delle informative
-- di rito, la procura è incompleta rispetto agli obblighi deontologici.
--
-- Perciò questi scheletri contengono il TESTO INTEGRALE, e l'istruzione è
-- di riprodurlo alla lettera sostituendo solo i dati fra parentesi quadre.
-- Non è generazione: è compilazione, ed è l'unico modo sicuro di farlo.

delete from public.stili_atto
 where studio_id is null
   and tipo in ('procura','dichiarazione_sostitutiva','relata_attestazione');

insert into public.stili_atto (studio_id, tipo, nome, scheletro) values

(null, 'procura', 'Studio — procura alle liti', $scheletro$
ATTENZIONE: questo documento si COMPILA, non si scrive. Riproduci il testo
qui sotto ALLA LETTERA, sostituendo soltanto ciò che sta fra parentesi
quadre. Non riformulare, non abbreviare, non riordinare, non aggiungere e
soprattutto non togliere nessuno dei poteri elencati: ciascuno di essi è un
potere che il difensore potrà esercitare solo se scritto.
Accorda il genere (sottoscritto/sottoscritta, nato/nata, informato/informata)
a quello dell'assistito. Se un dato non risulta dal fascicolo, lascialo come
[DA COMPLETARE: …].

FORMULA — DA RIPRODURRE ALLA LETTERA:

Procura alle liti

Il/La sottoscritto/a [cognome e nome], c.f.: [codice fiscale], nato/a il [data di nascita] a [luogo di nascita] e residente in [comune] in [indirizzo], informato/a della possibilità di ricorrere al procedimento di conciliazione, delego a rappresentarmi e difendermi nel presente procedimento in ogni sua fase e grado, cautelare, esecutiva e di impugnazione compresa, unitamente e disgiuntamente gli Avv.ti [nomi dei difensori], entrambi del Foro di [foro], conferendo loro ogni e più ampia facoltà di legge, ivi compresa quella di farsi sostituire, proporre domande riconvenzionali, chiamare in causa terzi, intervenire, riassumere, transigere e conciliare la lite, proporre opposizioni, appello e reclami, di riscuotere somme, rilasciare quietanze e ricevute, rinunziare agli atti, eleggere domicilio e nominare procuratori al di fuori del distretto, nominare consulenti di parte, deferire o riferire giuramenti e quant'altro occorrer possa, con espressa e preventiva ratifica di ogni suo atto e operato. Eleggo domicilio nel di loro studio sito in [sede dello studio].

Dichiaro, infine, di aver ricevuto rituale informativa sul trattamento dei dati conferiti ai sensi e per gli effetti del D.Lgs. n. 196/03 e di avere prestato il mio incondizionato consenso al trattamento di tali dati anche di natura sensibile o giudiziaria, e di essere stato/a informato/a ai sensi dell'art. 4 3° comma del D.Lgs. n. 28/10, della possibilità di ricorrere al procedimento di mediazione ivi previsto e dei benefici fiscali di cui agli artt. 17 e 20 del medesimo decreto, come da atto allegato. Dichiaro di essere stato/a informato/a, ai sensi dell'art. 2, co. 7, D.L. n. 132/2014, della possibilità di ricorrere alla convenzione di negoziazione assistita da uno o più avvocati disciplinata dagli artt. 2 e ss. del suddetto decreto legge. Dichiaro di essere stato/a reso/a edotto/a circa il grado di complessità dell'incarico che con la presente conferisco, nonché di avere ricevuto tutte le informazioni utili circa gli oneri ipotizzabili dal momento del conferimento sino alla conclusione dell'incarico.

[cognome e nome dell'assistito]

Vera e autentica la firma

[nomi dei difensori]
$scheletro$),

(null, 'dichiarazione_sostitutiva', 'Studio — dichiarazione sostitutiva di certificazione', $scheletro$
ATTENZIONE: documento da COMPILARE, non da scrivere. Riproduci la formula
alla lettera, sostituendo solo i dati fra parentesi quadre e accordando il
genere.

Esistono DUE varianti, che non vanno confuse perché il moltiplicatore del
reddito è diverso. Se le istruzioni del difensore non dicono quale serve,
producile entrambe una dopo l'altra, come si fa di regola quando si deposita
un ricorso previdenziale:

VARIANTE A — ex art. 152 disp. att. c.p.c. (esenzione nelle controversie
previdenziali): il reddito imponibile dev'essere inferiore a DUE VOLTE
l'importo di legge.

VARIANTE B — ex art. 42 d.l. 30/9/03 n. 269 (conv. l. 24 novembre 2003
n. 326): il reddito imponibile dev'essere inferiore a TRE VOLTE l'importo
di legge.

FORMULA — DA RIPRODURRE ALLA LETTERA (qui nella variante A; per la variante B
cambiano soltanto il sottotitolo, il richiamo normativo e "due volte" che
diventa "tre volte"):

DICHIARAZIONE SOSTITUTIVA DI CERTIFICAZIONE

EX ART. 152 DISP. ATT. C.P.C.

Il/La sottoscritto/a [cognome e nome], c.f. [codice fiscale], nato/a il [data] a [luogo], ed ivi residente in [indirizzo], consapevole della responsabilità giuridica che deriva da dichiarazioni non vere, ai fini dell'esenzione dal pagamento di spese, competenze e onorari nei giudizi introdotti

dichiara

ai sensi del d.p.r. n. 445/2000, che il reddito familiare del/della sottoscritto/a non supera il valore indicato nella norma di cui all'art. 152 disp. att. c.p.c. e, in particolare, dichiara che il reddito imponibile dello/a stesso/a ai fini IRPEF, risultante dall'ultima dichiarazione, è inferiore a due volte l'importo del reddito stabilito ai sensi degli articoli 76, commi da 1 a 3, e 77 del testo unico delle disposizioni legislative e regolamentari in materia di spese di giustizia di cui al decreto del Presidente della Repubblica 30 maggio 2002, n. 115;

si impegna altresì

a comunicare, fino a che il processo non sia definito, le variazioni rilevanti dei limiti di reddito verificatesi nell'anno precedente

[luogo], [data]                                        [cognome e nome]
$scheletro$),

(null, 'relata_attestazione', 'Studio — relata di notifica e attestazione di conformità', $scheletro$
ATTENZIONE: documento da COMPILARE, non da scrivere. Le formule della
notifica in proprio e dell'attestazione di conformità sono di rito: un
errore qui non produce un atto brutto, produce una notifica nulla o un
deposito rifiutato.

Regola sugli allegati, da rispettare con precisione: OGNI allegato va
descritto due volte con la MEDESIMA descrizione — la prima sotto "NOTIFICA",
la seconda dentro l'attestazione. Se le due descrizioni non coincidono
parola per parola, l'attestazione non copre ciò che è stato notificato.
Se l'elenco degli allegati non risulta dalle istruzioni, lascia
[DA COMPLETARE: elenco degli allegati].

FORMULA — DA RIPRODURRE ALLA LETTERA:

RELATA DI NOTIFICA

Il sottoscritto Avv. [nome del difensore], codice fiscale: [codice fiscale del difensore], iscritto all'albo degli Avvocati presso l'Ordine degli Avvocati di [foro], in ragione del disposto della L. 53/94 e succ. mod., quale difensore di [cognome e nome dell'assistito], c.f. [codice fiscale] in virtù della procura alle liti rilasciata ai sensi dell'art. 83, comma 3 c.p.c.

NOTIFICA

unitamente alla presente relazione i seguenti allegati:

[per ciascun allegato una riga: "[NOME FILE], copia informatica estratta dal fascicolo telematico contenente [descrizione del documento], firmato digitalmente;"]

a [denominazione del destinatario] (C.F./P.IVA: [codice]) all'indirizzo di posta elettronica certificata [pec] estratto da [pubblico elenco da cui è stato tratto l'indirizzo: IPA, INI-PEC, ReGIndE].

DICHIARA

che la presente notifica viene effettuata in relazione al procedimento pendente avanti al [autorità giudiziaria], RG n° [numero]/[anno].

ATTESTA

ai sensi e per gli effetti del combinato disposto degli artt. 196 octies e 196 undecies, comma 3 delle disp. att. c.p.c., che gli allegati [ripetizione letterale dell'elenco degli allegati, con le stesse descrizioni usate sopra] sono conformi ai corrispondenti documenti contenuti nel fascicolo informatico dal quale sono stati estratti.

[luogo], [data]

Firmato digitalmente da Avv. [nome del difensore]
$scheletro$);

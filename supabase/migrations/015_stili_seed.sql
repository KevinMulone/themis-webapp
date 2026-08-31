-- 015 — Scheletri iniziali, ricavati dagli atti reali dello studio
-- STATO: NON ancora applicata. Va eseguita dopo la 014.
--
-- Ogni scheletro qui sotto è stato ricavato leggendo atti veri del 2026 e
-- togliendo tutto ciò che identifica qualcuno. Se un giorno ti sembra che
-- un atto generato "non suoni giusto", è questo il file da correggere:
-- cambiare lo scheletro cambia tutti gli atti futuri di quel tipo, mentre
-- correggere il testo generato corregge un atto solo.

delete from public.stili_atto where studio_id is null and nome like 'Studio — %';

insert into public.stili_atto (studio_id, tipo, nome, scheletro) values

(null, 'diffida', 'Studio — diffida e messa in mora', $scheletro$
STRUTTURA E FORMULE

1. Blocco destinatario, allineato in alto:
   "Spett.le [denominazione]"
   "in persona del legale rappresentante pro tempore"
   [indirizzo, CAP e comune su righe separate]
   "PEC: [pec]"

2. "Oggetto: [Cognome assistito]/[Controparte]. - [oggetto in poche parole]"

3. Apertura, sempre in questa forma:
   "In nome, per conto e nell'interesse del sig./della sig.ra [nome], c.f. [codice fiscale], nato/a a [luogo] il [data], residente in [indirizzo], che mi ha conferito mandato, espongo quanto segue."
   Non si scrive mai "il sottoscritto avvocato".

4. Esposizione in fatto: un capoverso per fatto, in ordine di tempo, senza numerazione automatica. Ogni capoverso contiene una circostanza sola e verificabile. Dove il fatto poggia su un documento, lo si richiama per quello che è ("dall'esame del cedolino emerge…", "come da rapporto di intervento…").

5. Le contestazioni di merito seguono i fatti, ciascuna con la propria ragione. Il registro è asciutto: "risulta arbitrario e privo di fondamento", non l'indignazione.

6. Separatore "***" su riga propria fra i blocchi argomentativi.

7. Blocco in diritto, breve. Se serve un richiamo giurisprudenziale, va lasciato come [RICHIAMO GIURISPRUDENZIALE — a cura del difensore]: la struttura lo prevede, il contenuto lo mette il difensore.

8. Formula di passaggio: "Per quanto sopra, il sig./la sig.ra [nome], come sopra rappresentato/a e difeso/a"

9. Su riga propria e in maiuscolo: "INVITA E DIFFIDA"

10. Corpo della diffida: destinatario per esteso con codice fiscale e partita IVA, oggetto preciso della richiesta, importo se determinato, e termine espresso ("entro e non oltre giorni [n] dal ricevimento della presente").

11. Avvertimento: "Nel caso in cui il già menzionato termine decorrerà inutilmente, nostro malgrado, e senza alcun ulteriore avviso, si adiranno le competenti sedi giudiziarie, con aggravio di spese e competenze."

12. Chiusura di rito: "Si precisa, inoltre, che tale atto è da intendersi formale costituzione in mora ai sensi dell'art. 1219 c.c. e atto interruttivo della prescrizione."

13. "Si produce:" seguito dall'elenco degli allegati, uno per riga.

14. "[Luogo], [data]" e, a destra, "Avv. [nome del difensore]".
$scheletro$),

(null, 'richiesta_risarcimento', 'Studio — richiesta risarcimento / apertura sinistro', $scheletro$
STRUTTURA E FORMULE

1. Blocco destinatario: compagnia assicurativa "in persona del legale rappresentante p.t.", sede legale, PEC. Se i destinatari sono più d'uno (assicuratore e responsabile civile), si elencano uno sotto l'altro, ciascuno col proprio blocco completo.

2. "Oggetto: [tipo di richiesta] - [evento] del [data] in [luogo]. Sinistro n. [numero] - Polizza n. [numero]" — i riferimenti si mettono solo se risultano dal fascicolo; altrimenti [DA COMPLETARE].

3. "In nome, per conto e nell'esclusivo interesse del Sig./della Sig.ra [nome], nato/a a [luogo] il [data], c.f. [codice fiscale], residente in [indirizzo]".

4. "PREMESSO" su riga propria, seguito da capoversi che iniziano tutti con "— che ", in ordine cronologico stretto: l'evento, le circostanze immediate, i rilievi di terzi (Vigili del Fuoco, Polizia Municipale, pronto soccorso), i testimoni presenti, i danni, gli atti già compiuti (diffide precedenti, riscontri della compagnia, perizie), e infine lo stato attuale della trattativa.

5. "CONSIDERATO IN DIRITTO" su riga propria, sempre con capoversi "— che ": titolo di responsabilità invocato, norma di riferimento, e la ragione per cui si procede in questa sede.

6. Formula di passaggio: "Tutto ciò premesso, il sig./la sig.ra [nome], meglio sopra specificato/a, come sopra rappresentato/a e difeso/a"

7. Il verbo in maiuscolo su riga propria: "CHIEDE" (o "INVITA" quando l'atto è un invito).

8. Le richieste in lettere: "a)", "b)", "c)" — ciascuna una voce sola: riconoscimento della responsabilità, risarcimento del danno patrimoniale, del danno non patrimoniale, rifusione delle spese legali e tecniche, e in chiusura "ogni ulteriore voce di danno, patrimoniale e non patrimoniale, anche non espressamente menzionata".

9. Richiamo ai termini di riscontro previsti dalla legge per la formulazione dell'offerta.

10. Elenco numerato degli allegati, con la data di ciascun documento.

11. "[Luogo], [data]" e firma del difensore.
$scheletro$),

(null, 'negoziazione', 'Studio — invito a negoziazione assistita', $scheletro$
STRUTTURA E FORMULE

1. Blocchi destinatario, uno per ciascun invitato, ognuno con "in persona del legale rappresentante pro tempore", sede e PEC.

2. "Oggetto: Invito alla stipula di convenzione di negoziazione assistita - [evento] del [data] in [luogo]."

3. "In nome, per conto e nell'esclusivo interesse del Sig./della Sig.ra [nome], nato/a a [luogo] il [data], c.f. [codice fiscale], residente in [indirizzo]".

4. "PREMESSO" e capoversi "— che ": la vicenda per intero, in ordine di tempo, compresi gli atti stragiudiziali già compiuti e l'esito (o il silenzio) che li ha seguiti. L'ultimo capoverso dice perché oggi si arriva a questo invito.

5. "CONSIDERATO IN DIRITTO" e capoversi "— che ": qualificazione della responsabilità; se la materia rientra fra quelle a negoziazione obbligatoria lo si dice, altrimenti si richiama la facoltà delle parti di ricorrervi volontariamente; si chiude con la disponibilità alla composizione bonaria.

6. "Tutto ciò premesso, il sig./la sig.ra [nome], meglio sopra specificato/a, come sopra rappresentato/a e difeso/a"

7. "INVITA" in maiuscolo su riga propria.

8. Ciascun invitato per esteso, con sede, a stipulare convenzione di negoziazione assistita, indicando il termine per aderire e l'oggetto: le pretese in lettere "a)", "b)", "c)"…

9. Precisazione sull'ambito della negoziazione e avvertimento sulle conseguenze della mancata risposta o del rifiuto.

10. Indicazione del difensore che assiste la parte invitante e presso cui si elegge domicilio.

11. Elenco numerato degli allegati.

12. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'citazione', 'Studio — atto di citazione', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata, in maiuscolo, su righe separate:
   "TRIBUNALE [CIVILE] DI [città]"
   "SEZIONE [n.] CIVILE"
   "ATTO DI CITAZIONE [eventuale specificazione: PER REVOCAZIONE, IN OPPOSIZIONE…]"
   ed eventualmente il riferimento al provvedimento impugnato e alla norma ("EX ARTT. [.] C.P.C.").

2. L'attore per esteso: "[Nome], nato/a a [luogo] il [data] (c.f. [codice fiscale]), residente in [indirizzo], rappresentato/a e difeso/a dall'Avv. [nome] (c.f. […], PEC […]) giusta procura in calce al presente atto, presso il cui studio elegge domicilio".
   Poi, su riga propria: "- attore -" (o "- attrice in revocazione -", secondo il caso).

3. "CITA" in maiuscolo su riga propria.

4. I convenuti, uno per trattino, ciascuno con dati anagrafici, codice fiscale, residenza e — se già difesi in altro giudizio — l'indicazione del difensore e della PEC presso cui la notifica va eseguita. Poi "- convenuti -".

5. Vocatio in ius: "a comparire dinanzi al Tribunale di [città], Sezione [n.] Civile, in persona del giudice designando, all'udienza del [DA COMPLETARE: data — non prima di 120 giorni dalla notifica], ore di rito, con l'invito a costituirsi, ai sensi e nelle forme di cui all'art. 166 c.p.c., almeno venti giorni prima dell'udienza indicata, e con l'avvertimento che la costituzione oltre il suddetto termine implica le decadenze di cui agli artt. 38 e 167 c.p.c."

6. "per sentire accogliere le seguenti conclusioni, sulla base dei fatti e delle ragioni di diritto che seguono."

7. "PREMESSO IN FATTO" in maiuscolo. I fatti sono numerati progressivamente (1., 2., 3. …) e raggruppati sotto sottotitoli in numeri romani che descrivono la fase ("I. Il giudizio R.G. […] e la sentenza n. […]", "II. […]"). Un fatto per capoverso.

8. "IN DIRITTO" in maiuscolo, con la stessa numerazione progressiva che prosegue dal fatto. Dove servirebbe un precedente: [RICHIAMO GIURISPRUDENZIALE — a cura del difensore].

9. "IN VIA ISTRUTTORIA": mezzi di prova che si intendono articolare, capitoli e testi.

10. "CONCLUSIONI" in maiuscolo: "Voglia l'Ill.mo Tribunale adito, ogni contraria istanza ed eccezione disattesa," seguito dalle domande numerate, e in chiusura "con vittoria di spese, compensi e onorari di causa".

11. Dichiarazione di valore ai fini del contributo unificato.

12. "Si producono:" con l'elenco numerato degli allegati.

13. "[Luogo], [data]" e firma del difensore.
$scheletro$),

(null, 'ricorso_atp', 'Studio — ricorso ATP ex art. 445-bis c.p.c.', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata:
   "TRIBUNALE DI [città]"
   "-SEZIONE LAVORO E PREVIDENZA-"
   "Istanza di accertamento tecnico preventivo"
   "ex art. 445 bis c.p.c."

2. "Per il sig./la sig.ra [nome], c.f. [codice fiscale], nato/a il [data] a [luogo] e residente a [comune] in [indirizzo], rappresentato/a e difeso/a dall'Avv. [nome] giusta procura in calce, presso il cui studio elegge domicilio."

3. "Contro" su riga propria, poi l'ente per esteso con codice fiscale e sede ("Istituto Nazionale della Previdenza Sociale - I.N.P.S. - Sede provinciale di [città], c.f. […], corrente in […]").

4. "Avverso" su riga propria, poi il provvedimento impugnato descritto per intero: tipo di verbale, data, e che cosa ha riconosciuto o negato. Se i verbali sono due (invalidità civile e handicap), si indicano separatamente.

5. Separatore "*******" su riga propria.

6. Blocco di apertura in fatto: età del ricorrente, patologie da cui è affetto, e la domanda amministrativa presentata (data e oggetto). Poi l'esito della visita della commissione e, in una frase sola, la contestazione: "Il giudizio dell'INPS è errato e, pertanto, dovrà essere riformato."

7. Separatore "****".

8. Quadro clinico, disteso: diagnosi, storia della malattia con le date, ricoveri e trattamenti, terapie in corso, strutture che hanno in cura il ricorrente, e ciò che le certificazioni attestano — ciascun elemento ancorato al documento da cui risulta. Se ci sono state consulenze o accertamenti precedenti, si richiamano con il loro riferimento.
   Poi le conseguenze sulla vita quotidiana: autonomia, deambulazione, capacità di compiere gli atti quotidiani della vita, necessità di assistenza continua.

9. Blocco in diritto: i requisiti della prestazione richiesta, con i riferimenti normativi che ne sono il fondamento e la definizione di legge riportata. Dove il ragionamento poggia su un orientamento consolidato: [RICHIAMO GIURISPRUDENZIALE — a cura del difensore].

10. Separatore "****", poi la sussunzione: "Nel caso di specie, i certificati medici allegati dimostrano […]", con la conclusione che il ricorrente ha diritto alla prestazione e con la decorrenza richiesta.

11. Eventuali rilievi ulteriori (per esempio sulla mancata applicazione delle norme che esonerano da nuove visite in caso di patologie stabilizzate).

12. Formula di passaggio: "Tutto ciò sin qui rilevato, parte ricorrente, come sopra rappresentata e difesa"

13. "CHIEDE" in maiuscolo su riga propria.

14. Le domande al giudice, ciascuna per trattino: fissazione dell'udienza di comparizione con termine per la notifica; nomina del consulente tecnico d'ufficio con il quesito sull'accertamento delle condizioni sanitarie in relazione alla prestazione richiesta; decreto di omologa da notificare all'ente; vittoria di spese, compensi e onorari.

15. Dichiarazione di valore della controversia e, se ne ricorrono i presupposti, indicazione dell'esenzione dal contributo unificato.

16. Elenco numerato degli allegati: documento d'identità, verbali INPS, attestato di trasmissione della domanda, certificato medico trasmesso, dichiarazioni sostitutive ex art. 152 disp. att. c.p.c., documentazione sanitaria.

17. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'ricorso_amministrativo', 'Studio — ricorso amministrativo a ente', $scheletro$
STRUTTURA E FORMULE

1. Blocco destinatario: ente e ufficio competente, sede, PEC.

2. "Oggetto: Ricorso amministrativo avverso [provvedimento] n. [numero] del [data]. Assistito: [nome]."

3. "In nome, per conto e nell'interesse del sig./della sig.ra [nome], c.f. [codice fiscale], nato/a a [luogo] il [data], residente in [indirizzo]".

4. "PREMESSO" con capoversi "— che ": l'iter della pratica dal primo atto, ciascun passaggio con la sua data e il suo protocollo, fino al provvedimento contestato e alla sua notifica.

5. "MOTIVI DI RICORSO" in maiuscolo. Ogni motivo è autonomo, introdotto da un titolo breve, e si regge da solo: prima ciò che l'ente ha fatto o non ha fatto, poi la norma o il presupposto che è stato violato, poi la conseguenza.

6. Formula di passaggio: "Tutto ciò premesso, il sig./la sig.ra [nome], come sopra rappresentato/a e difeso/a"

7. "CHIEDE" in maiuscolo.

8. Le richieste all'ente, per trattino: annullamento o riforma del provvedimento, riconoscimento della prestazione con la decorrenza, ogni altro provvedimento conseguente.

9. Riserva di adire l'autorità giudiziaria in caso di mancato accoglimento o di silenzio nei termini di legge.

10. Elenco numerato degli allegati.

11. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'memoria', 'Studio — memoria difensiva', $scheletro$
STRUTTURA E FORMULE

1. Intestazione centrata: "TRIBUNALE DI [città]", sezione, e il tipo di scritto ("MEMORIA [integrativa / di replica / ex art. […] c.p.c.]").

2. Riferimento al giudizio: "Nel procedimento iscritto al n. [numero]/[anno] R.G., pendente tra [parte] (rappresentata e difesa dall'Avv. […]) e [controparte], giudice dott. [nome]".

3. Indicazione della parte per cui si scrive: "Per [nome], come in atti rappresentato/a e difeso/a".

4. Premessa breve sullo stato del giudizio: che cosa è successo all'udienza precedente, quale termine è stato assegnato e a quale fine.

5. Corpo della difesa, per punti numerati e con sottotitoli. Ogni punto affronta una questione sola. Dove si replica a una difesa avversaria, si riporta prima ciò che la controparte ha sostenuto e poi la ragione per cui non regge — mai il contrario.

6. Separatore "***" fra i blocchi.

7. Dove il ragionamento poggia su un precedente: [RICHIAMO GIURISPRUDENZIALE — a cura del difensore].

8. "CONCLUSIONI" in maiuscolo: riproposizione o precisazione delle domande già formulate, con "vittoria di spese e competenze".

9. Eventuali istanze istruttorie residue.

10. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'istanza', 'Studio — istanza', $scheletro$
STRUTTURA E FORMULE

Un'istanza lunga è un'istanza mal scritta: si sta dentro una pagina quando è possibile.

1. Destinatario: ufficio giudiziario e giudice, oppure ente e ufficio, con la PEC.

2. "Oggetto: Istanza di [oggetto preciso]. [Riferimento: R.G. n. […] / prot. n. […]]"

3. "In nome, per conto e nell'interesse del sig./della sig.ra [nome], c.f. [codice fiscale], […]".

4. "PREMESSO" con capoversi "— che ": soltanto i passaggi che servono a rendere comprensibile la richiesta, nient'altro.

5. "CHIEDE" in maiuscolo su riga propria.

6. La richiesta, formulata in modo che possa essere accolta parola per parola: se si chiede un termine, lo si quantifica; se si chiedono documenti, li si elenca.

7. Elenco degli allegati, se ce ne sono.

8. "[Luogo], [data]" e firma.
$scheletro$),

(null, 'relazione', 'Studio — relazione al cliente', $scheletro$
STRUTTURA E REGISTRO

Chi legge non è un giudice ma il cliente: niente formule di rito, niente latino, frasi brevi. Se un termine tecnico è inevitabile, lo si spiega fra parentesi la prima volta.

1. Intestazione semplice: "Gentile [nome]," e l'oggetto in una riga.

2. "Di che cosa si tratta" — la vicenda in tre o quattro frasi, come la racconteresti a voce.

3. "Che cosa è successo finora" — i passaggi in ordine di tempo, ciascuno con la sua data. Si scrive che cosa è stato fatto e che cosa ne è venuto fuori.

4. "A che punto siamo" — la situazione di oggi, senza addolcirla e senza allarmare.

5. "Che cosa succederà" — i prossimi passaggi con i tempi ragionevolmente prevedibili, dicendo chiaramente quando i tempi non dipendono dallo studio.

6. "Che cosa serve da lei" — l'elenco dei documenti o delle decisioni attese dal cliente, con il termine entro cui servono.

7. Chiusura con la disponibilità a un incontro e la firma.
$scheletro$);

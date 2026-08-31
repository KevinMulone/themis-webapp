-- 008 — Chiude la falla su portal_invites
-- STATO: NON ancora applicata.
-- ⚠️ ESEGUIRE SOLO DOPO che il codice che usa le funzioni della 007 è
--    in produzione. Eseguirla prima fa smettere di funzionare la
--    registrazione dal link d'invito e l'elenco documenti richiesti.
--
-- Il problema
-- -----------
-- La policy "Chiunque legge un invito dato il codice" era:
--     for select to public using (true)
-- Il nome esprimeva l'intenzione giusta, ma `USING (true)` significa
-- "tutte le righe, sempre": il database non può sapere che il codice era
-- nel WHERE di chi interroga. E `to public` comprende il ruolo `anon`.
--
-- Siccome la chiave anonima di Supabase è pubblica per costruzione (sta
-- nel JavaScript che ogni browser scarica), chiunque poteva leggere
-- l'intera tabella: nomi ed email dei clienti di TUTTI gli studi, più i
-- codici degli inviti non ancora usati — con cui ci si sarebbe potuti
-- registrare al posto di quel cliente.
--
-- Per uno studio legale anche il solo elenco dei nomi dei clienti è
-- informazione riservata.

-- Da qui in avanti l'unico modo per leggere un invito senza essere lo
-- studio proprietario è la funzione invito_portale(codice) della 007, che
-- restituisce una riga sola e nient'altro.
drop policy if exists "Chiunque legge un invito dato il codice" on public.portal_invites;

-- Resta in piedi la policy dello studio ("Lo studio gestisce i propri
-- inviti", auth.uid() = studio_id) più quella aggiunta dalla 006 per i
-- collaboratori: lo studio continua a creare e vedere i propri inviti.

-- ---------------------------------------------------------------------
-- Conseguenza da sistemare nello stesso momento
-- ---------------------------------------------------------------------
-- La policy di document_requests scritta nella 004 risaliva al client_id
-- del cliente con una sottoquery su portal_invites. Le policy si applicano
-- anche alle sottoquery dentro altre policy: tolta la policy aperta, quella
-- sottoquery non troverebbe più nulla e il cliente smetterebbe di vedere i
-- documenti richiesti.
--
-- La si sostituisce con la funzione della 007, che è SECURITY DEFINER e
-- legge direttamente portal_clients: più semplice, più diretta, e non
-- dipende più da portal_invites.
drop policy if exists "Cliente del portale vede le proprie richieste" on public.document_requests;

create policy "Cliente del portale vede le proprie richieste"
  on public.document_requests
  for select to authenticated
  using (client_id = public.cliente_portale_corrente());

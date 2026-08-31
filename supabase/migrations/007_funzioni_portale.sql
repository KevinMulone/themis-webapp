-- 007 — Funzioni del portale clienti (preparatoria alla 008)
-- STATO: NON ancora applicata.
-- SICURA IN QUALSIASI MOMENTO: aggiunge solo due funzioni, non tocca
-- nessuna policy e non cambia il comportamento di nulla.
--
-- Contesto: la 008 chiude una falla in portal_invites, ma per farlo deve
-- togliere una policy da cui il portale oggi dipende. Queste funzioni sono
-- la strada alternativa, e vanno create PRIMA che il codice del portale
-- cominci a usarle.
--
-- ORDINE CORRETTO:
--   1. questa migrazione (007)
--   2. deploy del codice che usa le funzioni
--   3. la 008, che chiude la falla
-- Così il portale non smette mai di funzionare, nemmeno per un istante.

-- ---------------------------------------------------------------------
-- Lettura di un invito dato il codice
-- ---------------------------------------------------------------------
-- Sostituisce la lettura diretta di portal_invites che il portale fa oggi
-- quando un cliente apre /portale?invite=CODICE senza essere ancora
-- registrato.
--
-- La differenza sostanziale rispetto alla policy attuale: qui il codice è
-- un ARGOMENTO, quindi il database restituisce davvero solo la riga
-- corrispondente. Una policy `USING (true)` invece rende leggibile tutta
-- la tabella, perché il database non ha modo di sapere che il codice era
-- nel WHERE di chi interroga.
--
-- Non restituisce mai il codice stesso né studio_id/client_id: solo quel
-- minimo che serve alla schermata di registrazione.
create or replace function public.invito_portale(p_code text)
returns table (email text, nome_cliente text, used boolean)
language sql
stable
security definer
set search_path = public
as $$
  select pi.email, pi.nome_cliente, pi.used
    from public.portal_invites pi
   where pi.code = p_code;
$$;

revoke all on function public.invito_portale(text) from public;
-- anon incluso di proposito: chi apre il link d'invito non ha ancora un
-- account. Il codice è un UUID casuale di 32 caratteri, indovinarlo non è
-- praticabile.
grant execute on function public.invito_portale(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Quale cliente è l'utente del portale attualmente collegato
-- ---------------------------------------------------------------------
-- handle_new_portal_client() (trigger su auth.users) scrive già
-- portal_clients.client_id al momento della registrazione, quindi la
-- risposta è a portata di una sola riga: non serve più passare da
-- portal_invites incrociando le email, come fanno oggi il portale e la
-- policy di document_requests.
create or replace function public.cliente_portale_corrente()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pc.client_id
    from public.portal_clients pc
   where pc.id = auth.uid();
$$;

revoke all on function public.cliente_portale_corrente() from public;
grant execute on function public.cliente_portale_corrente() to authenticated;

-- 006 — Policy: i collaboratori vedono i dati del proprio studio
-- STATO: NON ancora applicata. Va eseguita subito dopo la 005.
--
-- Diagnostica del 31.08.2026, esiti che rendono sicura questa migrazione:
--   * tutte le policy esistenti sono PERMISSIVE (nessuna RESTRICTIVE)
--   * relforcerowsecurity = false su tutte e 22 le tabelle
--
-- Perché è sicura
-- ---------------
-- In PostgreSQL le policy PERMISSIVE si sommano in OR: una riga è visibile
-- se ALMENO UNA policy la ammette. Siccome per un titolare
-- studio_corrente() vale esattamente auth.uid(), ogni policy aggiunta qui
-- è un sovrainsieme di quella già esistente: per chi c'è già non cambia
-- assolutamente nulla, per un collaboratore si aggiungono le righe del suo
-- studio. Le policy attuali non vengono né lette né modificate né rimosse.
--
-- Le nostre policy hanno tutte il prefisso "membri_" così restano
-- distinguibili da quelle preesistenti, e il drop iniziale tocca solo le
-- nostre (rende la migrazione ripetibile senza rischi).

-- ---------------------------------------------------------------------
-- Tabelle "normali": hanno una colonna studio_id e contengono dati dello
-- studio che i collaboratori devono poter leggere e scrivere.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tabelle text[] := array[
    'appointments',
    'availability_rules',
    'clients',
    'document_requests',
    'documenti',
    'eventi',
    'matters',
    'patrocini_spese_stato',
    'pec_account',
    'pec_messaggi',
    'pec_proposte',
    'portal_clients',
    'portal_invites',
    'sinistri',
    'studio_settings',
    'testimoni'
  ];
begin
  foreach t in array tabelle loop
    execute format('drop policy if exists membri_studio on public.%I', t);
    execute format($f$
      create policy membri_studio on public.%I
        for all to authenticated
        using (studio_id = public.studio_corrente())
        with check (studio_id = public.studio_corrente())
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Casi particolari
-- ---------------------------------------------------------------------

-- templates: studio_id è NULLO per i modelli di sistema, forniti da Themis
-- e uguali per tutti gli studi. Senza la condizione "is null" i
-- collaboratori li perderebbero e non potrebbero più generare atti.
drop policy if exists membri_templates_select on public.templates;
create policy membri_templates_select on public.templates
  for select to authenticated
  using (studio_id is null or studio_id = public.studio_corrente());

-- La scrittura invece resta ristretta ai propri: nessuno deve poter
-- modificare un modello di sistema.
drop policy if exists membri_templates_write on public.templates;
create policy membri_templates_write on public.templates
  for all to authenticated
  using (studio_id = public.studio_corrente())
  with check (studio_id = public.studio_corrente());

-- template_placeholders non ha una colonna studio_id: l'appartenenza si
-- eredita dal modello a cui si riferisce.
drop policy if exists membri_template_placeholders on public.template_placeholders;
create policy membri_template_placeholders on public.template_placeholders
  for all to authenticated
  using (exists (
    select 1 from public.templates t
     where t.id = template_id
       and (t.studio_id is null or t.studio_id = public.studio_corrente())
  ))
  with check (exists (
    select 1 from public.templates t
     where t.id = template_id
       and t.studio_id = public.studio_corrente()
  ));

-- studios: SOLO lettura, e mai scrittura.
-- Un collaboratore deve poter vedere il nome dello studio e lo stato
-- dell'abbonamento (il layout li mostra), ma l'abbonamento è del titolare:
-- modificarlo, disdirlo o riscattarci sopra una licenza non deve essere
-- possibile. Da qui in poi ogni scrittura su studios passa solo dalle
-- route server con la service role key, dopo verifica del ruolo.
drop policy if exists membri_studios_select on public.studios;
create policy membri_studios_select on public.studios
  for select to authenticated
  using (id = public.studio_corrente());

-- ---------------------------------------------------------------------
-- Volutamente NON toccate
-- ---------------------------------------------------------------------
-- pec_credenziali : RLS attiva e nessuna policy = nessun client può
--                   leggerla, mai. È corretto così e non va cambiato: le
--                   password delle caselle PEC le tocca solo il codice
--                   server con la service role key.
-- issued_licenses  : licenze emesse, non sono dati di studio.
-- stripe_webhook_events : solo service role.
-- studio_membri    : la sua policy di lettura è già nella migrazione 005.

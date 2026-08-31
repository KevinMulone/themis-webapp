-- 000 — DIAGNOSTICA, SOLA LETTURA. Non modifica nulla.
--
-- Da eseguire nell'SQL Editor di Supabase PRIMA della migrazione 005.
-- Serve a far emergere lo schema che oggi è invisibile dal codice: policy
-- di sicurezza, trigger e funzioni vivono solo sul progetto remoto, e la
-- migrazione 005 si basa su ipotesi che queste query confermano o smentiscono.
--
-- Eseguire un blocco alla volta e riportare l'esito.

-- ---------------------------------------------------------------------
-- A. SEMAFORO PRINCIPALE: esistono policy RESTRICTIVE?
--
-- La 005 aggiunge nuove policy accanto a quelle esistenti senza toccarle,
-- perché le policy PERMISSIVE si sommano in OR: la nuova è un
-- sovrainsieme di quella attuale e non può far regredire nulla.
-- Se invece qualche policy è RESTRICTIVE, quelle si sommano in AND e
-- bloccherebbero comunque i collaboratori: andrebbero riscritte.
-- => Se nella colonna "permissive" compare RESTRICTIVE, FERMARSI.
-- ---------------------------------------------------------------------
select tablename, policyname, permissive, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ---------------------------------------------------------------------
-- B. Il trigger su auth.users
--
-- Dedotto ma mai osservato: api/admin/create-studio/route.ts fa una UPDATE
-- (non una insert) sulla riga studios di un utente appena creato, quindi
-- qualcosa deve crearla automaticamente. Serve sapere esattamente cosa fa,
-- perché alla creazione di un collaboratore quel qualcosa creerà una riga
-- studios "orfana" da neutralizzare.
-- ---------------------------------------------------------------------
select t.tgname, c.relname as tabella, pg_get_triggerdef(t.oid) as definizione
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal
  and c.relname in ('users', 'studios');

-- ---------------------------------------------------------------------
-- C. Sorgente delle funzioni custom
--
-- redeem_license (riscatto licenze), get_taken_slots (slot occupati nel
-- portale) e la funzione chiamata dal trigger di (B).
-- ---------------------------------------------------------------------
select p.proname, pg_get_functiondef(p.oid) as definizione
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth')
  and p.proname not like 'pg%'
order by p.proname;

-- ---------------------------------------------------------------------
-- D. RLS: attiva? forzata?
--
-- relforcerowsecurity applica le policy anche al proprietario della
-- tabella: se fosse attivo su studio_membri, studio_corrente() (che la
-- legge in SECURITY DEFINER) andrebbe in ricorsione infinita.
-- ---------------------------------------------------------------------
select relname, relrowsecurity as rls_attiva, relforcerowsecurity as rls_forzata
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- ---------------------------------------------------------------------
-- E. Elenco reale delle colonne (per confermare le ipotesi del codice)
-- ---------------------------------------------------------------------
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

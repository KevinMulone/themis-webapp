-- 043 — Quanto spazio sta usando lo studio su Supabase
-- STATO: da applicare (SQL editor di Supabase, una volta sola; si può rieseguire).
--
-- Il piano gratuito di Supabase concede 1 GB di file e 500 MB di database. Quando
-- si superano, il progetto si blocca del tutto (accesso, dati e file) finché non si
-- libera spazio: è già successo una volta. Questa funzione dice quanto se ne sta usando,
-- così Themis può avvisare prima (Impostazioni e banner) e rifiutare nuovi caricamenti
-- quando lo spazio è quasi finito.
--
-- La possono chiamare solo il titolare e i collaboratori dello studio (e il server
-- con la service role): un cliente del portale non deve sapere quanto è pieno il progetto.

create or replace function public.spazio_usato()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.ruolo_corrente() not in ('titolare', 'collaboratore') then
    raise exception 'Non autorizzato';
  end if;
  return jsonb_build_object(
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'documents'), 0),
    'database_bytes', pg_database_size(current_database())
  );
end;
$$;

revoke all on function public.spazio_usato() from public, anon;
grant execute on function public.spazio_usato() to authenticated, service_role;

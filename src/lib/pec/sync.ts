import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scaricaNuoviMessaggi } from './imap';
import { interpretaMessaggioPec } from './parse';
import { decryptBuffer, encryptBuffer } from '@/lib/crypto/docEncryption';
import { DOCUMENTS_BUCKET } from '@/lib/supabase/admin';

const PEC_KEY_SCOPE_PREFIX = 'pec:';

export type RisultatoSincronizzazioneAccount = {
  accountId: string;
  ok: boolean;
  messaggiScaricati: number;
  errore?: string;
};

/**
 * Sincronizza UNA casella PEC: scarica i messaggi nuovi via IMAP, li
 * interpreta (messaggio vero o ricevuta), li cifra e li carica su Storage, e
 * registra ogni cosa in `pec_messaggi`. Aggiorna sempre lo stato della
 * casella (`pec_account`), anche in caso di errore, così l'errore diventa
 * visibile in Impostazioni invece di fallire in silenzio.
 *
 * Richiede il client admin (service role): deve poter leggere
 * `pec_credenziali`, che non ha nessuna policy RLS per nessun altro client.
 */
export async function sincronizzaAccount(
  admin: SupabaseClient,
  accountId: string,
): Promise<RisultatoSincronizzazioneAccount> {
  const { data: account, error: accountError } = await admin
    .from('pec_account')
    .select('*')
    .eq('id', accountId)
    .single();
  if (accountError || !account) {
    return { accountId, ok: false, messaggiScaricati: 0, errore: 'Casella non trovata' };
  }

  try {
    const { data: credenziali, error: credError } = await admin
      .from('pec_credenziali')
      .select('password_cifrata')
      .eq('pec_account_id', accountId)
      .single();
    if (credError || !credenziali) throw new Error('Credenziali non configurate per questa casella');

    const password = decryptBuffer(
      Buffer.from(credenziali.password_cifrata, 'base64'),
      PEC_KEY_SCOPE_PREFIX + account.studio_id,
    ).toString('utf-8');

    const esito = await scaricaNuoviMessaggi(
      { host: account.imap_host, port: account.imap_port, user: account.imap_user, password },
      account.last_seen_uid ?? 0,
      account.uid_validity !== null && account.uid_validity !== undefined ? BigInt(account.uid_validity) : null,
    );

    let inseriti = 0;
    for (const messaggio of esito.messaggi) {
      const interpretato = await interpretaMessaggioPec(messaggio.sorgente);
      const storagePath = `pec/${account.studio_id}/${account.id}/${messaggio.uid}.eml.enc`;

      const { error: uploadError } = await admin.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, encryptBuffer(messaggio.sorgente, account.studio_id), {
          contentType: 'application/octet-stream',
          upsert: true,
        });
      if (uploadError) throw new Error(`Salvataggio messaggio UID ${messaggio.uid}: ${uploadError.message}`);

      const { error: insertError } = await admin.from('pec_messaggi').insert({
        studio_id: account.studio_id,
        pec_account_id: account.id,
        imap_uid: messaggio.uid,
        tipo_pec: interpretato.tipoPec,
        mittente: interpretato.mittente,
        destinatari: interpretato.destinatari,
        oggetto: interpretato.oggetto,
        data_invio: interpretato.dataInvio,
        data_ricezione: new Date().toISOString(),
        storage_path_eml: storagePath,
      });
      // Codice 23505 = violazione di unicità (pec_account_id, imap_uid): il
      // messaggio è già stato registrato in un giro precedente, si ignora
      // invece di far fallire l'intera sincronizzazione.
      if (insertError && insertError.code !== '23505') {
        throw new Error(`Registrazione messaggio UID ${messaggio.uid}: ${insertError.message}`);
      }
      if (!insertError) inseriti += 1;
    }

    await admin
      .from('pec_account')
      .update({
        last_seen_uid: esito.ultimoUidVisto ?? account.last_seen_uid,
        uid_validity: esito.uidValidity.toString(),
        ultimo_controllo_at: new Date().toISOString(),
        ultimo_errore: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    return { accountId, ok: true, messaggiScaricati: inseriti };
  } catch (err) {
    const messaggioErrore = descriviErrore(err);
    await admin
      .from('pec_account')
      .update({ ultimo_controllo_at: new Date().toISOString(), ultimo_errore: messaggioErrore, updated_at: new Date().toISOString() })
      .eq('id', accountId);
    return { accountId, ok: false, messaggiScaricati: 0, errore: messaggioErrore };
  }
}

/**
 * Traduce un errore IMAP in qualcosa su cui si possa agire.
 *
 * ImapFlow segnala quasi tutto come «Command failed», che è vero e
 * inutile: la risposta del server sta in `responseText`, e la distinzione
 * fra «password sbagliata» e «server irraggiungibile» sta in campi
 * separati. Buttarli via significa costringere chi legge a indovinare, e
 * a cambiare parametri a caso finché qualcosa funziona.
 */
function descriviErrore(err: unknown): string {
  if (!(err instanceof Error)) return 'Errore sconosciuto';
  const e = err as Error & {
    responseText?: string;
    authenticationFailed?: boolean;
    serverResponseCode?: string;
    code?: string;
  };

  if (e.authenticationFailed) {
    return `Autenticazione rifiutata dal server${e.responseText ? `: ${e.responseText}` : ''}. `
      + 'Di solito significa password sbagliata, oppure che serve la password dedicata ai programmi di posta.';
  }
  if (e.code === 'ENOTFOUND') return `Server non trovato: controlla l'host IMAP (${e.message})`;
  if (e.code === 'ECONNREFUSED') return `Connessione rifiutata: controlla host e porta (${e.message})`;
  if (e.code === 'ETIMEDOUT') return 'Il server non risponde: host o porta probabilmente sbagliati';

  const parti = [e.message];
  if (e.responseText && e.responseText !== e.message) parti.push(e.responseText);
  if (e.serverResponseCode) parti.push(`[${e.serverResponseCode}]`);
  if (e.code && e.code !== e.message) parti.push(`(${e.code})`);
  return parti.join(' — ');
}

export { PEC_KEY_SCOPE_PREFIX };

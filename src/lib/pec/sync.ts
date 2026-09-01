import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scaricaMessaggi, elencaCartelle } from './imap';
import { MAX_MESSAGGI_PER_GIRO } from './costanti';
import { interpretaMessaggioPec } from './parse';
import { decryptBuffer, encryptBuffer } from '@/lib/crypto/docEncryption';
import { DOCUMENTS_BUCKET } from '@/lib/supabase/admin';

const PEC_KEY_SCOPE_PREFIX = 'pec:';

export type RisultatoSincronizzazioneAccount = {
  accountId: string;
  ok: boolean;
  messaggiScaricati: number;
  /** Quanti ne restano da prendere nella direzione richiesta. */
  restanti?: number;
  /** Quanti non si sono potuti archiviare (di solito: troppo grandi). */
  saltati?: number;
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
  modo: 'nuovi' | 'arretrato' = 'nuovi',
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

    const config = {
      host: account.imap_host, port: account.imap_port, user: account.imap_user, password,
    };

    // Al primo giro non sappiamo che cartelle abbia la casella: si chiede
    // al server. Si attivano ricevute, inviate e archivio; cestino e
    // indesiderata restano fuori, perche' non sono corrispondenza.
    let { data: cartelle } = await admin
      .from('pec_cartelle')
      .select('*')
      .eq('pec_account_id', accountId)
      .eq('attiva', true);

    if (!cartelle || cartelle.length === 0) {
      const sulServer = await elencaCartelle(config);
      const daAttivare = sulServer.filter((c) => c.ruolo !== 'altro');
      // Se il server non dichiara nulla di riconoscibile, almeno INBOX.
      const righe = (daAttivare.length > 0 ? daAttivare : [{
        percorso: 'INBOX', nome: 'INBOX', messaggi: 0, ruolo: 'inbox' as const,
      }]).map((c) => ({
        pec_account_id: accountId,
        studio_id: account.studio_id,
        percorso: c.percorso,
        ruolo: c.ruolo,
        attiva: true,
        // Le cartelle nuove ripartono da zero, tranne INBOX, che eredita il
        // segnalibro gia' raggiunto: altrimenti riscaricherebbe tutto.
        last_seen_uid: c.ruolo === 'inbox' ? (account.last_seen_uid ?? 0) : 0,
        uid_validity: c.ruolo === 'inbox' ? account.uid_validity ?? null : null,
      }));
      await admin.from('pec_cartelle').upsert(righe, { onConflict: 'pec_account_id,percorso' });
      const { data: riLette } = await admin
        .from('pec_cartelle').select('*')
        .eq('pec_account_id', accountId).eq('attiva', true);
      cartelle = riLette ?? [];
    }

    // Le ricevute prima delle inviate, l'archivio per ultimo. Ordinare per
    // nome metteva "archivio" davanti a tutto, e su una casella con anni di
    // storico si mangiava l'intero giro senza che arrivasse una sola PEC
    // nuova.
    const PRIORITA: Record<string, number> = { inbox: 0, inviata: 1, archivio: 2, altro: 3 };
    cartelle = [...cartelle].sort((a, b) => (PRIORITA[a.ruolo] ?? 9) - (PRIORITA[b.ruolo] ?? 9));

    let inseriti = 0;
    let restanti = 0;
    const saltati: { uid: number; motivo: string }[] = [];
    // Il tetto e' di tutto il giro, non di ogni cartella: e' il tempo della
    // funzione a essere limitato, e non gliene importa da quale cartella
    // vengano i messaggi.
    let budget = MAX_MESSAGGI_PER_GIRO;

    for (const cartella of cartelle) {
      if (budget <= 0) break;

      const esito = await scaricaMessaggi(config, cartella.percorso, {
        modo,
        lastSeenUid: cartella.last_seen_uid ?? 0,
        arretratoFinoA: cartella.arretrato_fino_a ?? null,
        uidValiditySalvato: cartella.uid_validity !== null && cartella.uid_validity !== undefined
          ? BigInt(cartella.uid_validity) : null,
        massimo: budget,
      });
      restanti += esito.restanti;

      for (const messaggio of esito.messaggi) {
        try {
        const interpretato = await interpretaMessaggioPec(messaggio.sorgente);
        // Il percorso include la cartella perche' gli UID si ripetono da una
        // cartella all'altra: senza, l'inviata n. 5 sovrascriverebbe la
        // ricevuta n. 5.
        const cartellaSlug = cartella.percorso.replace(/[^A-Za-z0-9]+/g, '_');
        const storagePath = `pec/${account.studio_id}/${account.id}/${cartellaSlug}/${messaggio.uid}.eml.enc`;

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
          cartella: cartella.percorso,
          direzione: cartella.ruolo === 'inviata' ? 'inviata' : 'ricevuta',
          imap_uid: messaggio.uid,
          tipo_pec: interpretato.tipoPec,
          mittente: interpretato.mittente,
          destinatari: interpretato.destinatari,
          oggetto: interpretato.oggetto,
          data_invio: interpretato.dataInvio,
          data_ricezione: new Date().toISOString(),
          storage_path_eml: storagePath,
        });
        // Codice 23505 = gia' registrato in un giro precedente: si ignora
        // invece di far fallire tutta la sincronizzazione.
        if (insertError && insertError.code !== '23505') {
          throw new Error(`Registrazione messaggio UID ${messaggio.uid}: ${insertError.message}`);
        }
        if (!insertError) inseriti += 1;
        } catch (erroreMessaggio) {
          // UN messaggio che non si riesce ad archiviare NON deve fermare la
          // casella. Prima l'eccezione interrompeva il giro, il segnalibro
          // non avanzava, e al giro successivo si ritentava lo stesso
          // messaggio: una PEC con un allegato oltre il limite dello storage
          // bloccava tutto per sempre, in silenzio.
          saltati.push({
            uid: messaggio.uid,
            motivo: erroreMessaggio instanceof Error ? erroreMessaggio.message : 'errore sconosciuto',
          });
        }
        budget -= 1;
      }

      // I due segnalibri si muovono in direzioni opposte: quello dei nuovi
      // solo verso l'alto, quello dell'arretrato solo verso il basso.
      const nuovoAlto = Math.max(cartella.last_seen_uid ?? 0, esito.uidMassimoPreso ?? 0);
      const bassoAttuale = esito.azzerato ? null : cartella.arretrato_fino_a;
      const nuovoBasso = esito.uidMinimoPreso === null
        ? bassoAttuale
        : Math.min(bassoAttuale ?? Number.MAX_SAFE_INTEGER, esito.uidMinimoPreso);

      await admin
        .from('pec_cartelle')
        .update({
          last_seen_uid: nuovoAlto,
          arretrato_fino_a: nuovoBasso,
          uid_validity: esito.uidValidity.toString(),
          ultimo_controllo_at: new Date().toISOString(),
        })
        .eq('id', cartella.id);
    }

    // I messaggi saltati restano scritti nell'ultimo errore: non fanno
    // fallire la sincronizzazione, ma non devono nemmeno sparire.
    const avviso = saltati.length
      ? `${saltati.length} messaggi non archiviati e saltati (${saltati[0].motivo}). `
        + 'Restano leggibili nella webmail del gestore.'
      : null;

    await admin
      .from('pec_account')
      .update({
        ultimo_controllo_at: new Date().toISOString(),
        ultimo_errore: avviso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    return { accountId, ok: true, messaggiScaricati: inseriti, restanti, saltati: saltati.length };
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

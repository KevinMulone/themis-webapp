'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Tiene aggiornata una pagina senza che l'utente debba ricaricarla.
 *
 * Meccanismo principale: Supabase Realtime. Il database annuncia le
 * modifiche alle tabelle indicate e il browser le riceve su una connessione
 * già aperta — nessuna interrogazione ripetuta, e le regole di sicurezza
 * continuano a valere (ognuno riceve solo ciò che potrebbe comunque
 * leggere).
 *
 * Rete di sicurezza: quando si torna sulla scheda dopo averla lasciata, si
 * ricarica comunque. Copre il caso in cui la connessione sia caduta mentre
 * il computer era sospeso o la rete assente — situazioni in cui un evento
 * andrebbe perso senza che nessuno se ne accorga.
 */
export function useAggiornamentoLive(tabelle: string[], aggiorna: () => void) {
  // La funzione di aggiornamento cambia identità a ogni render: tenerla in
  // un riferimento evita di disiscriversi e riscriversi continuamente.
  const callback = useRef(aggiorna);
  callback.current = aggiorna;

  const chiave = tabelle.join(',');

  useEffect(() => {
    const supabase = createClient();
    const elenco = chiave.split(',');

    // Nome univoco a ogni attivazione. Supabase tiene i canali in un
    // registro per nome, e rimuoverne uno è asincrono: riusando lo stesso
    // nome, un effetto che riparte prima che la rimozione sia conclusa si
    // vedrebbe restituire il canale vecchio, GIÀ sottoscritto — e
    // aggiungere ascoltatori dopo subscribe() è vietato, con eccezione.
    const canale = supabase.channel(`live:${chiave}:${Math.random().toString(36).slice(2)}`);

    // L'aggiornamento dal vivo è una comodità: se Realtime non è
    // disponibile o si comporta in modo imprevisto, la pagina deve
    // continuare a funzionare. Resta comunque la rete di sicurezza qui
    // sotto, che ricarica al ritorno sulla scheda.
    try {
      for (const tabella of elenco) {
        canale.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tabella },
          () => callback.current(),
        );
      }
      canale.subscribe();
    } catch (errore) {
      console.warn('Aggiornamento dal vivo non attivo:', errore);
    }

    function alRitorno() {
      if (document.visibilityState === 'visible') callback.current();
    }
    document.addEventListener('visibilitychange', alRitorno);
    window.addEventListener('focus', alRitorno);

    return () => {
      try {
        supabase.removeChannel(canale);
      } catch {
        // Se il canale era già stato rimosso non c'è nulla da fare.
      }
      document.removeEventListener('visibilitychange', alRitorno);
      window.removeEventListener('focus', alRitorno);
    };
  }, [chiave]);
}

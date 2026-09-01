'use client';

import { useEffect } from 'react';

/** Ogni quanto si va a vedere se è arrivata posta. */
const OGNI_MS = 3 * 60 * 1000;
/** Chi ha il turno, e fino a quando. Condiviso fra le schede aperte. */
const CHIAVE = 'themis:pec:ultimoGiro';

/**
 * Controlla la PEC da sola, mentre Themis è aperto.
 *
 * Non è vero tempo reale — quello richiederebbe una connessione IMAP
 * sempre aperta, che su un'architettura senza server non esiste — ma è
 * indistinguibile all'uso: entro tre minuti la PEC c'è, senza premere
 * niente.
 *
 * Il turno si prende attraverso localStorage: con cinque schede aperte
 * sarebbero cinque connessioni IMAP simultanee alla stessa casella, e i
 * gestori PEC le rifiutano. Così ne parte una sola, quale che sia la
 * scheda che ci arriva prima.
 */
export default function SincronizzazionePec() {
  useEffect(() => {
    let vivo = true;

    function tocca(): boolean {
      try {
        const ultimo = Number(localStorage.getItem(CHIAVE) || 0);
        if (Date.now() - ultimo < OGNI_MS - 5000) return false;
        localStorage.setItem(CHIAVE, String(Date.now()));
        return true;
      } catch {
        // Senza localStorage (finestra privata) si procede comunque: una
        // scheda sola è il caso normale.
        return true;
      }
    }

    async function giro() {
      // A scheda nascosta non si controlla: nessuno sta guardando, e il
      // giro costa una connessione al gestore.
      if (!vivo || document.hidden || !tocca()) return;
      try {
        const res = await fetch('/api/pec/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modo: 'nuovi' }),
        });
        const body = await res.json();
        const risultati = (body?.risultati ?? []) as { messaggiScaricati: number; letti?: number }[];
        const nuovi = risultati.reduce((s, r) => s + (r.letti ?? 0), 0);

        // Se non è arrivato niente di nuovo, il giro non si spreca: si fa
        // un passo di arretrato. Così l'archivio si completa da solo,
        // venticinque messaggi ogni tre minuti, senza che nessuno debba
        // premere un pulsante finché non è finito. Le PEC nuove restano
        // comunque prima: l'arretrato prende solo il turno avanzato.
        if (nuovi === 0) {
          await fetch('/api/pec/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modo: 'arretrato' }),
          });
        }
      } catch {
        // Rete assente o casella non configurata: si riprova al giro dopo,
        // in silenzio. Questo è un servizio di fondo, non deve disturbare.
      }
    }

    giro();
    const t = setInterval(giro, OGNI_MS);
    // Tornando sulla scheda dopo un po', si controlla subito invece di
    // aspettare il prossimo giro.
    const alRitorno = () => { if (!document.hidden) giro(); };
    document.addEventListener('visibilitychange', alRitorno);

    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', alRitorno);
    };
  }, []);

  return null;
}

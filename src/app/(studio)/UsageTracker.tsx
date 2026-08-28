'use client';

import { useEffect } from 'react';

const INTERVALLO_MS = 60000;

// Componente invisibile montato nel layout dell'area studio: manda un
// segnale ogni minuto mentre la scheda è visibile, per stimare quanto
// tempo lo studio passa realmente ad usare Themis (mostrato nel pannello
// amministratore). Nessuna UI, nessuna interazione con la pagina.
export default function UsageTracker() {
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetch('/api/usage-heartbeat', { method: 'POST' }).catch(() => {});
      }
    }, INTERVALLO_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}

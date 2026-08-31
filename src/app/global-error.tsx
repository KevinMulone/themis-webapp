'use client';

/**
 * Ultima rete: cattura gli errori che avvengono così in alto da coinvolgere
 * anche il layout principale, dove error.tsx dei singoli percorsi non
 * arriva. Deve dichiarare <html> e <body> per conto suo, perché sostituisce
 * l'intero documento.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="it">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem', background: '#f5f5f5' }}>
        <div style={{ maxWidth: 560, margin: '10vh auto', background: '#fff', borderRadius: 12, padding: '2rem', border: '1px solid #e5e5e5' }}>
          <h1 style={{ margin: '0 0 .25rem', fontSize: '1rem', color: '#b91c1c' }}>
            Qualcosa non ha funzionato
          </h1>
          <p style={{ margin: '0 0 1rem', fontSize: '.875rem', color: '#525252' }}>
            L&apos;applicazione non è riuscita a caricarsi. I tuoi dati non sono stati toccati.
          </p>
          <div style={{ background: '#fafafa', borderRadius: 6, padding: '.75rem', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 .25rem', fontSize: '.7rem', color: '#737373' }}>Dettaglio tecnico</p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '.75rem', color: '#404040', wordBreak: 'break-word' }}>
              {error.message || 'Errore senza messaggio'}
            </p>
            {error.digest && (
              <p style={{ margin: '.25rem 0 0', fontFamily: 'monospace', fontSize: '.7rem', color: '#a3a3a3' }}>
                codice: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            style={{ background: '#6b1d39', color: '#fff', border: 0, borderRadius: 6, padding: '.5rem 1rem', fontSize: '.875rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}

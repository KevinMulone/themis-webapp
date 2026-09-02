'use client';

import { useEffect, useRef, useState } from 'react';

type Stato = { configurato: boolean; stato?: 'disconnesso' | 'in_attesa_qr' | 'connesso'; numero?: string };

/**
 * Componente a sé, non dentro impostazioni/page.tsx: quella pagina è già
 * grande e piena di stato condiviso, e questa funzione ha un ciclo di vita
 * tutto suo (il poll del QR) che non deve intrecciarsi con `load()` del
 * resto della pagina. Si limita a chiedere il proprio stato e a
 * mostrarlo.
 */
export default function ImpostazioniWhatsapp() {
  const [stato, setStato] = useState<Stato | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [connettendo, setConnettendo] = useState(false);
  const [disconnettendo, setDisconnettendo] = useState(false);
  const [errore, setErrore] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function caricaStato(): Promise<Stato> {
    const res = await fetch('/api/whatsapp/stato');
    const body = (await res.json()) as Stato;
    setStato(body);
    return body;
  }

  useEffect(() => {
    caricaStato();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function avviaPoll() {
    if (pollRef.current) clearInterval(pollRef.current);
    // Il QR di WhatsApp scade in circa un minuto: un poll lento lo
    // farebbe leggere già scaduto la metà delle volte.
    pollRef.current = setInterval(async () => {
      const body = await caricaStato();
      if (body.stato === 'connesso' && pollRef.current) {
        setQr(null);
        clearInterval(pollRef.current);
      }
    }, 2500);
  }

  async function connetti() {
    setErrore('');
    setConnettendo(true);
    const res = await fetch('/api/whatsapp/connetti', { method: 'POST' });
    const body = await res.json();
    setConnettendo(false);
    if (!res.ok) { setErrore(body.error || 'Collegamento non riuscito'); return; }
    setStato((prev) => ({ ...(prev ?? { configurato: true }), stato: body.stato, numero: body.numero }));
    if (body.stato === 'connesso') { setQr(null); return; }
    setQr(body.qr);
    avviaPoll();
  }

  async function disconnetti() {
    if (!confirm('Scollegare WhatsApp? Themis smetterà di leggere i messaggi in arrivo su questo numero, finché non lo ricolleghi.')) return;
    setDisconnettendo(true);
    await fetch('/api/whatsapp/disconnetti', { method: 'POST' });
    setDisconnettendo(false);
    setQr(null);
    if (pollRef.current) clearInterval(pollRef.current);
    caricaStato();
  }

  if (!stato) return null;

  return (
    <div className="mb-4 rounded-xl bg-neutral-50 p-6">
      <h2 className="mb-1 font-semibold text-neutral-900">WhatsApp</h2>
      <p className="mb-3 text-xs leading-relaxed text-neutral-500">
        Collega un numero <strong>dedicato allo studio</strong>, non il numero personale di un avvocato: il
        collegamento non passa dai canali ufficiali di WhatsApp, ed è il numero collegato — non chi lo usa —
        a correre il rischio in caso di blocco da parte di WhatsApp.
      </p>

      {!stato.configurato ? (
        <div className="rounded-lg bg-white p-4">
          <p className="text-sm font-medium text-neutral-900">Non ancora configurato su questo sito</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Serve un servizio di collegamento a parte, con due variabili d&rsquo;ambiente:{' '}
            <span className="font-medium text-neutral-700">WHATSAPP_WORKER_URL</span> e{' '}
            <span className="font-medium text-neutral-700">WHATSAPP_WORKER_SECRET</span>. Finché mancano, il
            collegamento non può partire.
          </p>
        </div>
      ) : stato.stato === 'connesso' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Connesso al numero {stato.numero || '—'}</p>
            <p className="text-xs text-neutral-500">I messaggi in arrivo compaiono nella pagina WhatsApp.</p>
          </div>
          <button
            type="button" onClick={disconnetti} disabled={disconnettendo}
            className="premi rounded-full bg-red-50 px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {disconnettendo ? 'Scollegamento...' : 'Scollega'}
          </button>
        </div>
      ) : qr ? (
        <div className="rounded-lg bg-white p-4 text-center">
          <p className="mb-3 text-sm text-neutral-700">
            Apri WhatsApp sul telefono dedicato allo studio → Impostazioni → Dispositivi collegati →
            Collega un dispositivo, e inquadra questo codice.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Codice QR per collegare WhatsApp" className="mx-auto h-56 w-56" />
          <p className="mt-2 text-xs text-neutral-400">
            Il codice scade dopo circa un minuto: se scompare prima che tu riesca a inquadrarlo, premi di
            nuovo &quot;Connetti&quot;.
          </p>
        </div>
      ) : (
        <button
          type="button" onClick={connetti} disabled={connettendo}
          className="premi rounded-full bg-bordeaux-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
        >
          {connettendo ? 'Generazione del codice...' : 'Connetti WhatsApp'}
        </button>
      )}
      {errore && <p className="mt-2 text-xs text-red-600">{errore}</p>}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { clientLabel } from '@/lib/constants';
import WhatsappProposte from './WhatsappProposte';

type Messaggio = {
  id: string; jidMittente: string; testo: string; direzione: 'in' | 'out';
  statoMatch: 'abbinato' | 'non_riconosciuto'; clienteId: string | null; matterId: string | null;
  ricevutoIl: string; clienteNome: string | null;
};

type ClienteOpzione = { id: string; label: string };

type Stato = { configurato: boolean; stato?: 'disconnesso' | 'in_attesa_qr' | 'connesso'; numero?: string };

function oraIt(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * La casella d'ingresso di WhatsApp: scadenze proposte, messaggi non
 * ancora collegati a un cliente, e le conversazioni con cui rispondere —
 * mai in automatico, sempre con una bozza da rileggere prima di premere
 * "Invia".
 */
export default function WhatsappPage() {
  const supabase = useMemo(() => createClient(), []);
  const [stato, setStato] = useState<Stato | null>(null);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [clienti, setClienti] = useState<ClienteOpzione[]>([]);
  const [collegamento, setCollegamento] = useState<Record<string, string>>({});
  const [bozze, setBozze] = useState<Record<string, string>>({});
  const [generando, setGenerando] = useState('');
  const [inviando, setInviando] = useState('');

  const caricaMessaggi = useCallback(async () => {
    const res = await fetch('/api/whatsapp/messaggi');
    if (!res.ok) return;
    const body = await res.json();
    setMessaggi(body.messaggi || []);
  }, []);

  useEffect(() => {
    fetch('/api/whatsapp/stato').then((r) => r.json()).then(setStato).catch(() => setStato(null));
    caricaMessaggi();
    supabase.from('clients').select('id, nome, cognome, ragione_sociale, tipo_soggetto')
      .eq('archiviato', false).order('cognome')
      .then(({ data }) => setClienti((data || []).map((c) => ({ id: c.id, label: clientLabel(c) }))));
  }, [caricaMessaggi, supabase]);

  const nonRiconosciuti = messaggi.filter((m) => m.direzione === 'in' && m.statoMatch === 'non_riconosciuto');

  // Le conversazioni, dalla più recente: si scorre l'elenco (già ordinato
  // dal più recente) e si registra l'ordine di prima comparsa di ogni
  // mittente, poi si mostra ciascun gruppo dal più vecchio al più nuovo.
  const conversazioni = useMemo(() => {
    const gruppi = new Map<string, Messaggio[]>();
    for (const m of messaggi) {
      if (!gruppi.has(m.jidMittente)) gruppi.set(m.jidMittente, []);
      gruppi.get(m.jidMittente)!.push(m);
    }
    return [...gruppi.entries()].map(([jid, msgs]) => ({ jid, messaggi: [...msgs].reverse() }));
  }, [messaggi]);

  async function collega(messaggioId: string) {
    const clienteId = collegamento[messaggioId];
    if (!clienteId) return;
    await fetch('/api/whatsapp/messaggi', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messaggioId, clienteId }),
    });
    caricaMessaggi();
  }

  async function generaBozza(messaggioId: string) {
    setGenerando(messaggioId);
    const res = await fetch('/api/themis/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaggioId }),
    });
    const body = await res.json();
    setGenerando('');
    if (!res.ok) { alert(body.error || 'Bozza non riuscita'); return; }
    setBozze((prev) => ({ ...prev, [messaggioId]: body.testo }));
  }

  async function invia(messaggioId: string) {
    const testo = bozze[messaggioId];
    if (!testo?.trim()) return;
    setInviando(messaggioId);
    const res = await fetch('/api/whatsapp/invia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaggioId, testo }),
    });
    const body = await res.json();
    setInviando('');
    if (!res.ok) { alert(body.error || 'Invio non riuscito'); return; }
    setBozze((prev) => { const next = { ...prev }; delete next[messaggioId]; return next; });
    caricaMessaggi();
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">WhatsApp</h1>

      {stato && !stato.configurato && (
        <div className="mb-4 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-600">
          WhatsApp non è ancora attivo su questo sito.
        </div>
      )}
      {stato?.configurato && stato.stato !== 'connesso' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-gold-50 p-4 text-sm text-gold-800">
          <span>Nessun numero collegato: i messaggi non arriveranno finché non lo colleghi.</span>
          <Link href="/impostazioni" className="premi shrink-0 font-medium underline">
            Vai a Impostazioni
          </Link>
        </div>
      )}
      {stato?.stato === 'connesso' && (
        <p className="mb-4 text-xs text-neutral-500">Collegato al numero {stato.numero}.</p>
      )}

      <WhatsappProposte />

      {nonRiconosciuti.length > 0 && (
        <div className="mb-4 rounded-2xl bg-neutral-50 p-5">
          <h2 className="mb-1 font-semibold text-neutral-900">Messaggi da collegare a un cliente</h2>
          <p className="mb-3 text-sm text-neutral-500">
            Il numero non corrisponde a nessun cliente in anagrafica. Il messaggio resta qui finché
            non lo colleghi: non viene mai scartato da solo.
          </p>
          <ul className="space-y-2">
            {nonRiconosciuti.map((m) => (
              <li key={m.id} className="rounded-lg bg-white p-3">
                <p className="text-xs text-neutral-400">{m.jidMittente.split('@')[0]} · {oraIt(m.ricevutoIl)}</p>
                <p className="mt-1 text-sm text-neutral-800">{m.testo}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={collegamento[m.id] || ''}
                    onChange={(e) => setCollegamento((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-bordeaux-400"
                  >
                    <option value="">Scegli un cliente...</option>
                    {clienti.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <button
                    type="button" onClick={() => collega(m.id)} disabled={!collegamento[m.id]}
                    className="premi rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    Collega
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-neutral-50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Conversazioni recenti</h2>
          <button type="button" onClick={caricaMessaggi} className="premi text-xs text-neutral-500 hover:text-neutral-700">
            Aggiorna
          </button>
        </div>
        {conversazioni.length === 0 ? (
          <p className="text-sm text-neutral-500">Ancora nessun messaggio ricevuto.</p>
        ) : (
          <div className="space-y-4">
            {conversazioni.map(({ jid, messaggi: msgs }) => {
              const ultimo = msgs[msgs.length - 1];
              const puoRispondere = ultimo.direzione === 'in';
              return (
                <div key={jid} className="rounded-xl bg-white p-4">
                  <p className="mb-2 text-xs font-medium text-neutral-500">
                    {msgs.find((m) => m.clienteNome)?.clienteNome || jid.split('@')[0]}
                  </p>
                  <ul className="space-y-1.5">
                    {msgs.slice(-6).map((m) => (
                      <li
                        key={m.id}
                        className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                          m.direzione === 'in'
                            ? 'bg-neutral-100 text-neutral-800'
                            : 'ml-auto bg-bordeaux-50 text-bordeaux-900'
                        }`}
                      >
                        {m.testo}
                        <span className="ml-2 text-[10px] text-neutral-400">{oraIt(m.ricevutoIl)}</span>
                      </li>
                    ))}
                  </ul>

                  {puoRispondere && (
                    <div className="mt-3 border-t border-neutral-100 pt-3">
                      {bozze[ultimo.id] === undefined ? (
                        <button
                          type="button" onClick={() => generaBozza(ultimo.id)} disabled={generando === ultimo.id}
                          className="premi rounded-lg border border-bordeaux-700 px-3 py-1.5 text-xs font-medium text-bordeaux-700 hover:bg-bordeaux-50 disabled:opacity-50"
                        >
                          {generando === ultimo.id ? 'Themis sta scrivendo...' : 'Genera bozza di risposta'}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            value={bozze[ultimo.id]}
                            onChange={(e) => setBozze((prev) => ({ ...prev, [ultimo.id]: e.target.value }))}
                            rows={3}
                            className="w-full rounded-lg border border-neutral-200 bg-white p-2 text-sm outline-none focus:border-bordeaux-400"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button" onClick={() => invia(ultimo.id)} disabled={inviando === ultimo.id}
                              className="premi rounded-full bg-bordeaux-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                            >
                              {inviando === ultimo.id ? 'Invio...' : 'Invia'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setBozze((prev) => { const n = { ...prev }; delete n[ultimo.id]; return n; })}
                              className="premi rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200"
                            >
                              Annulla
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

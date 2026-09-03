'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { clientLabel } from '@/lib/constants';
import WhatsappProposte from './WhatsappProposte';

type Messaggio = {
  id: string; jidMittente: string; testo: string; direzione: 'in' | 'out';
  statoMatch: 'abbinato' | 'non_riconosciuto'; clienteId: string | null; matterId: string | null;
  ricevutoIl: string; clienteNome: string | null; nomeWhatsapp: string | null;
  statoInvio: 'inviato' | 'consegnato' | 'letto' | null;
  documentoNome: string | null;
};

/** 1 spunta grigia (inviato) -> 2 grigie (consegnato) -> 2 blu (letto). */
function Spunte({ stato }: { stato: Messaggio['statoInvio'] }) {
  if (!stato) return null;
  const blu = stato === 'letto';
  const doppia = stato !== 'inviato';
  return (
    <svg viewBox="0 0 18 12" className={`ml-1 inline-block h-3 w-4 align-text-bottom ${blu ? 'text-sky-500' : 'text-neutral-400'}`}>
      <path d="M1 6.5 4.5 10 11 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {doppia && (
        <path d="M6 6.5 9.5 10 16 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Il nome del cliente Themis vince sempre; il nome che il mittente ha
 *  impostato su WhatsApp è un ripiego migliore del numero nudo per i
 *  contatti non ancora abbinati; il numero resta l'ultima risorsa. */
function nomeConversazione(msgs: Messaggio[], jid: string): string {
  return msgs.find((m) => m.clienteNome)?.clienteNome
    || msgs.find((m) => m.nomeWhatsapp)?.nomeWhatsapp
    || jid.split('@')[0];
}

type ClienteOpzione = { id: string; label: string };

type Stato = { configurato: boolean; stato?: 'disconnesso' | 'in_attesa_qr' | 'connesso'; numero?: string };

function oraBreve(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function dataOraBreve(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * La casella d'ingresso di WhatsApp, come un vero programma di chat: un
 * elenco di conversazioni a sinistra, la conversazione aperta a destra.
 * Le scadenze proposte dall'IA restano più in basso, un passo indietro
 * rispetto alle chat vere e proprie.
 */
export default function WhatsappPage() {
  const supabase = useMemo(() => createClient(), []);
  const [stato, setStato] = useState<Stato | null>(null);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [clienti, setClienti] = useState<ClienteOpzione[]>([]);
  const [collegamento, setCollegamento] = useState<Record<string, string>>({});
  const [percorso, setPercorso] = useState<Record<string, 'esistente' | 'nuovo'>>({});
  const [nuovoTipo, setNuovoTipo] = useState<Record<string, 'persona_fisica' | 'persona_giuridica'>>({});
  const [nuovoNome, setNuovoNome] = useState<Record<string, string>>({});
  const [nuovoCognome, setNuovoCognome] = useState<Record<string, string>>({});
  const [nuovoRagioneSociale, setNuovoRagioneSociale] = useState<Record<string, string>>({});
  const [creandoCliente, setCreandoCliente] = useState('');
  const [motiviSuggerimento, setMotiviSuggerimento] = useState<Record<string, string>>({});
  const richiesteSuggerimento = useRef<Set<string>>(new Set());
  const [composizione, setComposizione] = useState<Record<string, string>>({});
  const [generando, setGenerando] = useState('');
  const [inviando, setInviando] = useState('');
  const [selezionata, setSelezionata] = useState<string | null>(null);
  const fondoChatRef = useRef<HTMLDivElement>(null);
  const areaTestoRef = useRef<HTMLTextAreaElement>(null);

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

  // Poll leggero: una chat aperta deve aggiornarsi da sola, non solo
  // quando si preme "Aggiorna".
  useEffect(() => {
    const id = setInterval(caricaMessaggi, 15000);
    return () => clearInterval(id);
  }, [caricaMessaggi]);

  // Solo chi manda un documento, una foto o un video chiede davvero
  // attenzione: un semplice messaggio di testo da un numero sconosciuto
  // resta comunque visibile in "Conversazioni recenti", ma non deve
  // costringere l'avvocato a decidere qualcosa ogni volta che scrive
  // qualcuno che non conosce.
  const nonRiconosciuti = messaggi.filter(
    (m) => m.direzione === 'in' && m.statoMatch === 'non_riconosciuto' && m.documentoNome,
  );

  // Un suggerimento per volta, la prima volta che un documento non
  // riconosciuto compare — mai richiesto di nuovo per lo stesso
  // messaggio, altrimenti il poll ogni 15 secondi lo chiederebbe
  // ripetutamente e spenderebbe credito IA senza motivo. Precompila la
  // scelta, ma non decide da sola: resta un suggerimento da confermare.
  useEffect(() => {
    for (const m of nonRiconosciuti) {
      if (richiesteSuggerimento.current.has(m.id)) continue;
      richiesteSuggerimento.current.add(m.id);
      fetch('/api/themis/whatsapp-abbina', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaggioId: m.id }),
      })
        .then((r) => r.json())
        .then((body) => {
          const s = body?.suggerimento;
          if (!s) return;
          if (s.motivo) setMotiviSuggerimento((prev) => ({ ...prev, [m.id]: s.motivo }));
          if (s.tipo === 'esistente' && s.clienteId) {
            setPercorso((prev) => ({ ...prev, [m.id]: 'esistente' }));
            setCollegamento((prev) => ({ ...prev, [m.id]: s.clienteId }));
          } else if (s.tipo === 'nuovo') {
            setPercorso((prev) => ({ ...prev, [m.id]: 'nuovo' }));
            setNuovoTipo((prev) => ({ ...prev, [m.id]: s.tipoSoggetto === 'persona_giuridica' ? 'persona_giuridica' : 'persona_fisica' }));
            if (s.nome) setNuovoNome((prev) => ({ ...prev, [m.id]: s.nome }));
            if (s.cognome) setNuovoCognome((prev) => ({ ...prev, [m.id]: s.cognome }));
            if (s.ragioneSociale) setNuovoRagioneSociale((prev) => ({ ...prev, [m.id]: s.ragioneSociale }));
          }
        })
        .catch(() => {});
    }
  }, [nonRiconosciuti]);

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

  useEffect(() => {
    if (!selezionata && conversazioni.length > 0) setSelezionata(conversazioni[0].jid);
  }, [conversazioni, selezionata]);

  const aperta = conversazioni.find((c) => c.jid === selezionata) ?? null;

  // Scorre da sola all'ultimo messaggio: alla prima apertura della
  // conversazione e ogni volta che ne arriva uno nuovo, come in un vero
  // programma di chat — non deve mai essere l'utente a doverlo cercare.
  useEffect(() => {
    fondoChatRef.current?.scrollIntoView({ block: 'end' });
  }, [aperta?.jid, aperta?.messaggi.length]);

  // La casella si allarga da sola col testo scritto, fino a un limite,
  // esattamente come in WhatsApp: oltre quel limite scorre al suo interno
  // invece di continuare a crescere all'infinito.
  useEffect(() => {
    const el = areaTestoRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [aperta?.jid, composizione[aperta?.jid ?? '']]);

  async function collega(messaggioId: string) {
    const clienteId = collegamento[messaggioId];
    if (!clienteId) return;
    await fetch('/api/whatsapp/messaggi', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messaggioId, clienteId }),
    });
    caricaMessaggi();
  }

  async function creaClienteECollega(messaggioId: string) {
    const tipoSoggetto = nuovoTipo[messaggioId] || 'persona_fisica';
    setCreandoCliente(messaggioId);
    const res = await fetch('/api/whatsapp/messaggi', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: messaggioId,
        nuovoCliente: {
          tipoSoggetto,
          nome: nuovoNome[messaggioId] || '',
          cognome: nuovoCognome[messaggioId] || '',
          ragioneSociale: nuovoRagioneSociale[messaggioId] || '',
        },
      }),
    });
    const body = await res.json();
    setCreandoCliente('');
    if (!res.ok) { alert(body.error || 'Cliente non creato'); return; }
    caricaMessaggi();
  }

  async function generaBozza(jid: string, messaggioId: string) {
    setGenerando(jid);
    const res = await fetch('/api/themis/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // Quello che l'avvocato ha già scritto: se c'è, l'IA lo struttura
      // invece di ignorarlo e proporne uno tutto suo.
      body: JSON.stringify({ messaggioId, bozza: composizione[jid] || '' }),
    });
    const body = await res.json();
    setGenerando('');
    if (!res.ok) { alert(body.error || 'Bozza non riuscita'); return; }
    setComposizione((prev) => ({ ...prev, [jid]: body.testo }));
  }

  async function invia(jid: string, messaggioId: string) {
    const testo = composizione[jid];
    if (!testo?.trim()) return;
    setInviando(jid);
    const res = await fetch('/api/whatsapp/invia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaggioId, testo }),
    });
    const body = await res.json();
    setInviando('');
    if (!res.ok) { alert(body.error || 'Invio non riuscito'); return; }
    setComposizione((prev) => ({ ...prev, [jid]: '' }));
    caricaMessaggi();
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
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

      {nonRiconosciuti.length > 0 && (
        <div className="mb-4 rounded-2xl bg-neutral-50 p-4">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            {nonRiconosciuti.length} messagg{nonRiconosciuti.length === 1 ? 'io' : 'i'} da collegare a un cliente
          </p>
          <ul className="space-y-3">
            {nonRiconosciuti.map((m) => {
              const scelta = percorso[m.id] || 'esistente';
              const tipo = nuovoTipo[m.id] || 'persona_fisica';
              return (
                <li key={m.id} className="rounded-lg bg-white p-3 text-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{m.jidMittente.split('@')[0]}</span>
                    <span className="min-w-0 flex-1 truncate text-neutral-700">{m.testo}</span>
                  </div>
                  {motiviSuggerimento[m.id] && (
                    <p className="mb-2 text-[11px] italic text-bordeaux-700">
                      Themis suggerisce: {motiviSuggerimento[m.id]} — controlla prima di confermare.
                    </p>
                  )}

                  <div className="mb-2 flex gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio" checked={scelta === 'esistente'}
                        onChange={() => setPercorso((prev) => ({ ...prev, [m.id]: 'esistente' }))}
                      />
                      È un cliente già registrato
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio" checked={scelta === 'nuovo'}
                        onChange={() => setPercorso((prev) => ({ ...prev, [m.id]: 'nuovo' }))}
                      />
                      È un cliente nuovo
                    </label>
                  </div>

                  {scelta === 'esistente' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={collegamento[m.id] || ''}
                        onChange={(e) => setCollegamento((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-bordeaux-400"
                      >
                        <option value="">Chi è...</option>
                        {clienti.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <button
                        type="button" onClick={() => collega(m.id)} disabled={!collegamento[m.id]}
                        className="premi rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      >
                        Allega al fascicolo
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={tipo}
                        onChange={(e) => setNuovoTipo((prev) => ({ ...prev, [m.id]: e.target.value as 'persona_fisica' | 'persona_giuridica' }))}
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-bordeaux-400"
                      >
                        <option value="persona_fisica">Persona fisica</option>
                        <option value="persona_giuridica">Azienda / ente</option>
                      </select>
                      {tipo === 'persona_fisica' ? (
                        <>
                          <input
                            placeholder="Nome" value={nuovoNome[m.id] || ''}
                            onChange={(e) => setNuovoNome((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            className="w-28 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-bordeaux-400"
                          />
                          <input
                            placeholder="Cognome" value={nuovoCognome[m.id] || ''}
                            onChange={(e) => setNuovoCognome((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            className="w-28 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-bordeaux-400"
                          />
                        </>
                      ) : (
                        <input
                          placeholder="Ragione sociale" value={nuovoRagioneSociale[m.id] || ''}
                          onChange={(e) => setNuovoRagioneSociale((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          className="w-56 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-bordeaux-400"
                        />
                      )}
                      <button
                        type="button" onClick={() => creaClienteECollega(m.id)} disabled={creandoCliente === m.id}
                        className="premi rounded-full bg-bordeaux-700 px-3 py-1 text-xs font-medium text-white hover:bg-bordeaux-800 disabled:opacity-50"
                      >
                        {creandoCliente === m.id ? 'Creazione...' : 'Crea cliente e allega'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex h-[65vh] min-h-[420px] overflow-hidden rounded-2xl bg-neutral-50">
        {/* Elenco conversazioni */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-medium text-neutral-500">Conversazioni</span>
            <button type="button" onClick={caricaMessaggi} className="premi text-xs text-neutral-500 hover:text-neutral-700">
              Aggiorna
            </button>
          </div>
          {conversazioni.length === 0 ? (
            <p className="px-4 py-2 text-sm text-neutral-500">Ancora nessun messaggio ricevuto.</p>
          ) : (
            <ul>
              {conversazioni.map(({ jid, messaggi: msgs }) => {
                const ultimo = msgs[msgs.length - 1];
                const nome = nomeConversazione(msgs, jid);
                return (
                  <li key={jid}>
                    <button
                      type="button"
                      onClick={() => setSelezionata(jid)}
                      className={`premi block w-full border-b border-neutral-100 px-4 py-3 text-left transition-colors ${
                        jid === selezionata ? 'bg-white' : 'hover:bg-white/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-neutral-900">{nome}</span>
                        <span className="shrink-0 text-[11px] text-neutral-400">{oraBreve(ultimo.ricevutoIl)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {ultimo.direzione === 'out' ? 'Tu: ' : ''}{ultimo.testo}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Conversazione aperta */}
        <section className="flex min-w-0 flex-1 flex-col">
          {!aperta ? (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
              Scegli una conversazione dall&rsquo;elenco.
            </div>
          ) : (
            <>
              <div className="border-b border-neutral-200 px-5 py-3">
                <p className="text-sm font-medium text-neutral-900">
                  {nomeConversazione(aperta.messaggi, aperta.jid)}
                </p>
                <p className="text-xs text-neutral-400">{aperta.jid.split('@')[0]}</p>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto px-5 py-4">
                {aperta.messaggi.map((m) => (
                  <div key={m.id} className={`flex ${m.direzione === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                        m.direzione === 'in' ? 'bg-white text-neutral-800' : 'bg-bordeaux-50 text-bordeaux-900'
                      }`}
                    >
                      {m.documentoNome && (
                        <a
                          href={`/api/whatsapp/messaggi/${m.id}/documento`}
                          className="premi mb-1 flex items-center gap-1.5 rounded-md bg-black/5 px-2 py-1.5 text-xs font-medium text-inherit underline decoration-dotted hover:bg-black/10"
                        >
                          📄 {m.documentoNome}
                        </a>
                      )}
                      <span className="whitespace-pre-wrap">{m.testo}</span>
                      <span className="ml-2 align-bottom text-[10px] text-neutral-400">{dataOraBreve(m.ricevutoIl)}</span>
                      {m.direzione === 'out' && <Spunte stato={m.statoInvio} />}
                    </div>
                  </div>
                ))}
                <div ref={fondoChatRef} />
              </div>

              <div className="border-t border-neutral-200 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={areaTestoRef}
                    value={composizione[aperta.jid] || ''}
                    onChange={(e) => setComposizione((prev) => ({ ...prev, [aperta.jid]: e.target.value }))}
                    placeholder="Scrivi un messaggio..."
                    rows={1}
                    className="max-h-[200px] min-h-[2.5rem] flex-1 resize-none overflow-y-auto rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-bordeaux-400"
                  />
                  <button
                    type="button"
                    onClick={() => generaBozza(aperta.jid, aperta.messaggi[aperta.messaggi.length - 1].id)}
                    disabled={generando === aperta.jid}
                    title="Genera una bozza di risposta con Themis"
                    className="premi shrink-0 rounded-lg border border-bordeaux-700 px-3 py-2 text-xs font-medium text-bordeaux-700 hover:bg-bordeaux-50 disabled:opacity-50"
                  >
                    {generando === aperta.jid ? '...' : 'IA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => invia(aperta.jid, aperta.messaggi[aperta.messaggi.length - 1].id)}
                    disabled={inviando === aperta.jid || !composizione[aperta.jid]?.trim()}
                    className="premi shrink-0 rounded-full bg-bordeaux-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bordeaux-800 disabled:opacity-50"
                  >
                    {inviando === aperta.jid ? '...' : 'Invia'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="mt-4">
        <WhatsappProposte />
      </div>
    </div>
  );
}
